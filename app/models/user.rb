class User < ApplicationRecord
  has_many :notifications, dependent: :destroy
  has_secure_password
  has_secure_token :auth_token
  has_many :sessions, dependent: :destroy
  has_many :user_structures, dependent: :destroy
  has_many :structures, through: :user_structures
  has_many :explorations, dependent: :destroy
  has_one :active_exploration, -> { where(status: :active) }, class_name: "Exploration"
  has_many :recruitment_orders, dependent: :destroy
  has_many :user_units, dependent: :destroy
  has_many :units, through: :user_units
  accepts_nested_attributes_for :user_units, update_only: true
  
  has_many :user_spells, dependent: :destroy
  has_many :spells, through: :user_spells
  belongs_to :active_defense_spell, class_name: "Spell", optional: true
  
  has_many :bids, dependent: :destroy
  has_many :market_listings, foreign_key: :lister_id # if applicable, though lister is usually system generated for now


  has_many :active_spells, dependent: :destroy
  # has_many :active_defense_spell, class_name: "Spell", optional: true # Deprecate these later
  
  normalizes :email_address, with: ->(e) { e.strip.downcase }
  normalizes :username, with: ->(u) { u.strip }
  normalizes :kingdom_name, with: ->(n) { n.strip }

  validates :username, presence: true, uniqueness: true, length: { minimum: 3, maximum: 20 }, format: { with: /\A[a-zA-Z0-9_]+\z/, message: "can only contain letters, numbers, and underscores" }
  validates :kingdom_name, uniqueness: true, length: { maximum: 15 }, format: { with: /\A[a-zA-Z0-9 ]+\z/, message: "can only contain letters, numbers, and spaces" }, allow_nil: true
  validates :color, presence: true, inclusion: { in: Affinity.valid_ids, message: "%{value} is not a valid magic affinity" }
  validates :land, numericality: { greater_than_or_equal_to: 0 }

  before_create :set_initial_game_state
  after_create :grant_initial_structures

  def army_strength
    user_units.includes(:unit).sum { |uu| (uu.unit.attack.to_i + uu.unit.defense.to_i + uu.unit.speed.to_i) * (uu.quantity.to_i + uu.garrison.to_i) }
  end

  def net_power
    # A rough estimate of total player power
    # value of land (100) + army strength + magic power * 10
    (land * 100) + army_strength + (magic_power * 10)
  end

  def under_protection?
    protection_expires_at.present? && protection_expires_at > Time.current
  end

  def affinity
    @affinity ||= Affinity.find(color) || Affinity.all.first
  end

  def has_resources?(cost)
    cost.all? do |resource, amount|
      case resource.to_s
      when 'gold' then gold >= amount
      when 'mana' then mana >= amount
      else true # Ignore unknown resources for now
      end
    end
  end

  def deduct_resources!(cost)
    cost.each do |resource, amount|
      case resource.to_s
      when 'gold' then decrement!(:gold, amount)
      when 'mana' then decrement!(:mana, amount)
      end
    end
  end

  # Resource logic
  def tax_multiplier
    tc = user_structures.joins(:structure).where(structures: { slug: 'town_center' }).pick(:level) || 1
    1.0 + (tc * 0.05)
  end

  def magic_power
    mp = 10 # Base magic power
    
    # Structure Bonuses
    user_structures.includes(:structure).each do |us|
      case us.structure.slug
      when 'altar'
        mp += us.level * 20
      when 'mana_core'
        mp += us.level * 3
      end
    end
    
    # Mana Battery Charge Impact
    # 0% Charge: -50% Magic Power
    # 100% Charge: +10% Magic Power (Overcharge)
    charge = current_mana_charge
    
    if charge < 0.1
      mp = (mp * 0.5).to_i
    elsif charge > 0.9
      mp = (mp * 1.1).to_i
    end
    
    mp
  end
  
  def summon_quantity_multiplier
    # Base: 1.0
    # Formula: 1 + (Magic Power / 100.0)
    # 10 MP -> 1.1x
    # 50 MP -> 1.5x
    # 100 MP -> 2.0x
    (1.0 + (magic_power / 100.0)).round(2)
  end

  def recruitment_slots
    1 + (barracks_level / 2)
  end

  def active_recruitment_orders
    recruitment_orders.active
  end

  def barracks_level
    barracks = structures.find_by(slug: "barracks")
    return 0 unless barracks
    user_structures.find_by(structure: barracks)&.level || 0
  end

  def production_rates
    # Base rates could be 0 or small base amount
    rates = { gold: 0, wood: 0, stone: 0, iron: 0, food: 0, mana: 0 }
    
    user_structures.includes(:structure).each do |us|
      structure = us.structure
      multiplier = structure.level_based ? us.level : us.quantity
      
      # Use the new production_at_level helper logic, but optimized for bulk calculation
      # For level_based: Base * Level
      # For quantity_based: Base * Quantity
      
      # Ensure structure.production is a hash
      base_production = structure.production || {}
      
      # Also check legacy columns if production is empty
      if base_production.empty?
        rates[:gold] += structure.base_income_gold.to_i * multiplier
        rates[:mana] += structure.base_income_mana.to_i * multiplier
      else
        base_production.each do |resource, amount|
          rates[resource.to_sym] ||= 0
          rates[resource.to_sym] += (amount.to_i * multiplier)
        end
      end
    end
    
    rates.with_indifferent_access
  end

  def max_mana
    gross_mana_cap - reserved_mana
  end

  def gross_mana_cap
    base = 200
    
    user_structures.includes(:structure).each do |us|
      case us.structure.slug
      when 'mana_core'
        base += us.level * 500
      when 'altar'
        base += us.level * 250
      end
    end
    
    base
  end
  
  def reserved_mana
    # Assume 'self' type spells are buffs that reserve mana for now
    user_spells.joins(:spell).where(active: true).sum('spells.mana_cost')
  end

  def used_land
    sum = 0
    user_structures.includes(:structure).each do |us|
      structure = us.structure
      if structure.level_based?
        sum += structure.cumulative_land_cost(us.level)
      else
        sum += us.quantity * structure.land_cost
      end
    end
    sum
  end

  def free_land
    [land - used_land, 0].max
  end

  def display_kingdom_name
    kingdom_name.presence || "Kingdom of #{username}"  
  end

  def grant_initial_structures
    # Define initial structure quantities
    initial_loadout = {
      'town_center' => 1,
      'barracks' => 1,
      'mana_core' => 1,
      'bank' => 1,
      'altar' => 1
    }

    initial_loadout.each do |slug, quantity|
      structure = Structure.find_by(slug: slug)
      next unless structure
      
      user_structure = user_structures.find_or_initialize_by(structure: structure)
      user_structure.quantity ||= 0
      user_structure.quantity = [user_structure.quantity, quantity].max
      user_structure.save!
    end
    
    # Set initial Mana to max capacity (calculated based on structures)
    update(mana: max_mana)
  end

  private

  def set_initial_game_state
    self.land ||= 10
    self.gold ||= 10_000
    self.mana ||= 0 # Will be filled to capacity in callback
    self.protection_expires_at = 24.hours.from_now
    self.morale ||= 100
    self.morale_updated_at ||= Time.current
    self.last_mana_recharge_at ||= Time.current
  end

  # Mana Generation Logic
  public
  
  def mana_drain_duration
    4.hours
  end
  
  def current_mana_charge
    # 0.0 (just released) → 1.0 (fully charged / overload risk)
    elapsed = Time.current - (last_mana_recharge_at || Time.current)
    [elapsed.to_f / mana_drain_duration, 1.0].min
  end
  
  # Total expenses that drain mana over time (per 4-hour cycle to match potential)
  def mana_upkeep_potential
    # Active spell upkeep
    spell_upkeep = user_spells.joins(:spell).where(active: true).sum('spells.mana_cost')
    
    # Unit Upkeep
    unit_upkeep = user_units.includes(:unit).sum { |uu| uu.quantity * (uu.unit.mana_upkeep || 0) }
    
    spell_upkeep + unit_upkeep
  end

  # Total potential mana generation per full charge cycle (4 hours)
  def mana_generation_potential
    # Base generation
    potential = 50
    
    # Structure Income (fetching directly from production stats)
    # Using production_rates to ensure single source of truth from DB
    potential += production_rates[:mana].to_i
    
    # Active spell bonuses (Generation)
    user_spells.joins(:spell).where(active: true).each do |us|
      case us.spell.name
      when 'Serenity'
        potential += 25 
      when 'Meditation'
        potential += 50
      end
    end

    # Active Buff Bonuses (Dynamic)
    active_spells.includes(:spell).each do |active|
       meta = active.metadata || {}
       if meta['stat_target'] == 'mana_recovery' || meta['stat_target'] == 'mana_production'
          potential += meta['magnitude'].to_i
       end
    end
    
    potential
  end

  def net_mana_potential
      mana_generation_potential - mana_upkeep_potential
  end

  def mana_breakdown
    breakdown = { income: [], expenses: [] }
    
    # Income: Base
    breakdown[:income] << { name: 'Base Recovery', amount: 50 }
    
    # Income: Structures
    user_structures.includes(:structure).each do |us|
      structure = us.structure
      prod = structure.production || {}
      base = prod['mana'].to_i + structure.base_income_mana.to_i
      multiplier = structure.level_based ? us.level : us.quantity
      amount = base * multiplier
      
      if amount > 0
        breakdown[:income] << { name: "#{structure.name} (Lvl #{us.level})", amount: amount }
      end
    end
    
    # Income: Spells (Generation)
    user_spells.joins(:spell).where(active: true).each do |us|
      amount = 0
      case us.spell.name
      when 'Serenity'
        amount = 25 
      when 'Meditation'
        amount = 50
      end
      
      if amount > 0
        breakdown[:income] << { name: us.spell.name, amount: amount }
      end
    end
    # Active Buff Bonuses (Dynamic)
    active_spells.includes(:spell).each do |active|
       meta = active.metadata || {}
       if meta['stat_target'] == 'mana_recovery' || meta['stat_target'] == 'mana_production'
          breakdown[:income] << { name: "#{active.spell.name} (Active)", amount: meta['magnitude'].to_i }
       end
    end    
    # Expenses: Spells
    user_spells.joins(:spell).where(active: true).each do |us|
      cost = us.spell.mana_cost || 0
      if cost > 0
        breakdown[:expenses] << { name: us.spell.name, amount: cost }
      end
    end
    
    # Expenses: Units
    user_units.includes(:unit).each do |uu|
      unit_cost = uu.unit.mana_upkeep || 0
      total_cost = uu.quantity * unit_cost
      if total_cost > 0
        breakdown[:expenses] << { name: "#{uu.unit.name} (#{uu.quantity})", amount: total_cost }
      end
    end
    
    breakdown
  end

  def current_power
     army_score = user_units.includes(:unit).sum { |uu| uu.quantity * (uu.unit.power || 3) }
     economy_score = land * 5
     magic_score = user_spells.where(learned: true).count * 10
     
     army_score + economy_score + magic_score
  end

  def active_spell_bonus(stat)
    active_spells.active.sum do |spell| 
      if spell.metadata && spell.metadata['stat_target'] == stat.to_s
        spell.metadata['magnitude'].to_f
      else
        0.0
      end
    end
  end

  def current_base_morale
    # Lazy decay calculation
    # Rate: 100 points per 24 hours (approx 4.16 per hour)
    return 100.0 if morale.nil? # Handle legacy/uninitialized with full morale

    elapsed_seconds = Time.current - (morale_updated_at || created_at)
    
    final_decay_rate = current_morale_decay_rate_per_second

    decayed_volume = elapsed_seconds * final_decay_rate
    
    # Base calculation
    [morale.to_f - decayed_volume, 0.0].max
  end

  def current_morale
    # Apply Active Spells
    # We add the buff AFTER the decay floor check.
    total = current_base_morale + active_spell_bonus(:morale)
    
    # Cap at 100
    [total, 100.0].min
  end
  
  def current_morale_decay_rate_per_second
    base_decay_rate = 100.0 / 1.day.to_i
    
    current_size = total_army_size
    cap = army_capacity
    
    if cap > 0 && current_size > cap
      # E.g. 200 / 100 = 2.0 ratio
      # Use square root to make the penalty curve more forgiving
      ratio = current_size.to_f / cap
      # Cap the multiplier at 5.0x (minimum ~5 hours to decay fully)
      penalty_mult = [Math.sqrt(ratio), 5.0].min
      base_decay_rate * penalty_mult
    else
      base_decay_rate
    end
  end

  def morale_penalty_multiplier
    current_size = total_army_size
    cap = army_capacity
    
    if cap > 0 && current_size > cap
      ratio = current_size.to_f / cap
      [Math.sqrt(ratio), 5.0].min
    else
      1.0
    end
  end
  
  def total_army_size
    # Sum of all units. We use cache or direct query.
    # To improve performance, we might cache this in user later.
    user_units.sum(:quantity) || 0
  end

  def total_army_upkeep
    user_units.includes(:unit).sum { |uu| uu.quantity * uu.unit.upkeep_cost }
  end

  def army_capacity
    # Base capacity: 50
    base = 50
    
    # Add capacity from structures (Field Camps, Barracks etc)
    user_structures.includes(:structure).each do |us|
      structure = us.structure
      multiplier = structure.level_based ? us.level : us.quantity
      
      # Use JSON production field
      prod = structure.production || {}
      if prod['army_capacity']
        base += (prod['army_capacity'].to_i * multiplier)
      elsif structure.slug == 'barracks'
         # Fallback for Barracks if not in JSON yet
         base += (50 * multiplier)
      end
    end
    
    base
  end
  
  def update_morale!(new_value)
    self.morale = new_value
    self.morale_updated_at = Time.current
    save!
  end

  def garrison_strength
    user_units.where('garrison > 0').includes(:unit).sum do |uu|
      (uu.garrison || 0) * (uu.unit.defense || 0)
    end
  end

  def field_army_strength
    user_units.where('quantity > garrison').includes(:unit).sum do |uu|
      available = uu.quantity - (uu.garrison || 0)
      available * (uu.unit.attack || 0)
    end
  end
end
