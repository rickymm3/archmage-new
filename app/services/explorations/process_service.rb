
module Explorations
  class ProcessService
    attr_reader :exploration, :unit, :initial_qty, :resources

    def initialize(exploration)
      @exploration = exploration
      @unit = exploration.unit
      @initial_qty = exploration.quantity
      @survivors = @initial_qty
      @log = []
      @land_potential = (@exploration.resources_found['potential_land'] || 1).to_i
      @tc_level = exploration.user.user_structures
                    .joins(:structure)
                    .where(structures: { slug: 'town_center' })
                    .pick(:level) || 1
      
      @resources = { 
        "gold" => 0, 
        "land" => @land_potential, 
        "mana" => 0,
        "items" => [], 
        "units_found" => [],
        "survivors" => 0,
        "potential_land_start" => @land_potential
      }
      
      @main_team_alive = true
    end

    def call
      return unless @exploration.active?

      duration = (@exploration.finishes_at - @exploration.started_at).to_i
      minutes = (duration / 60.0).ceil
      
      # Determine number of "events" in the story
      # Minimum 3 events, Maximum 10.
      num_events = [minutes / 5, 3].max
      num_events = [num_events, 10].min
      
      if @unit && @initial_qty > 0
        @log << "The expedition departs, escorted by #{@initial_qty} #{@unit.name.pluralize}. (Initial Target: #{@land_potential} Land)"
      else
        @log << "The expedition departs alone, with no military escort. (Initial Target: #{@land_potential} Land)"
      end

      num_events.times do |i|
        break unless @main_team_alive
        
        # Combat is the primary danger of exploration (~60% of events).
        # Base combat chance: 60%, escorts reduce it slightly.
        base_combat = 60
        modifier = (@unit && @survivors > 0) ? 0.85 : 1.0
        combat_chance = (base_combat * modifier).ceil
        
        roll = rand(100)
        
        if roll < combat_chance
          process_combat(i + 1)
        elsif roll < combat_chance + 25
          process_discovery(i + 1)
        elsif roll < combat_chance + 35
          process_setback(i + 1)
        else
          process_uneventful(i + 1)
        end
      end
      
      finalize_exploration
    end

    private
    
    def process_combat(step)
      enemy_types = [
        { 
          name: "Bandit Ambush", 
          power: 10, 
          rewards: { gold: rand(30..80) }, 
          text: "Your team was ambushed by bandits!" 
        },
        { 
          name: "Wild Wolves", 
          power: 5, 
          rewards: {}, # No loot from wolves usually
          text: "A pack of wolves attacked the camp." 
        },
        { 
          name: "Goblin Raiders", 
          power: 15, 
          rewards: { gold: rand(80..150) }, 
          text: "Your scouts spotted a Goblin raiding party carrying loot." 
        },
        { 
          name: "Ancient Guardian", 
          power: 30, 
          rewards: { gold: 500, mana: 100 }, 
          text: "An ancient construct awakened and blocked the path." 
        },
        { 
          name: "Mana Wyrm", 
          power: 20, 
          rewards: { mana: rand(50..150) }, 
          text: "A glowing mana wyrm defended its territory." 
        },
        {
          name: "Slaver Caravan",
          power: 25,
          rewards: { gold: 100, units: [{ slug: 'militia', amount: rand(5..15) }] },
          text: "You intercepted a slaver caravan transporting prisoners."
        }
      ]
      
      encounter = enemy_types.sample
      
      # Enemy power scales with Town Center level.
      # At TC1: expect militia (atk 2), ~20-50 units => team power ~60-150
      # At TC5: expect heavy infantry (atk 10), ~30-80 units => team power ~330-880
      # At TC10: expect top tier (atk 80-120), ~20-50 units => team power ~1620-6050
      #
      # Base power per TC level represents a "typical" encounter for that tier.
      # encounter[:power] acts as a difficulty multiplier (5-30 base).
      tc_power_table = [0, 30, 80, 160, 300, 500, 800, 1200, 1800, 2800, 4000]
      base_for_tc = tc_power_table[@tc_level] || tc_power_table.last
      
      # Enemy power = base scaled by encounter difficulty + some randomness
      difficulty_mult = encounter[:power] / 15.0  # normalize around 1.0 (range ~0.33 to 2.0)
      variance = rand(0.7..1.3)
      enemy_power = (base_for_tc * difficulty_mult * variance).ceil
      
      # Combat Calculation
      if @unit && @survivors > 0
        escort_attack = @survivors * (@unit.attack + 1)
        escort_defense = [(@unit.defense + 1), 1].max
      else
        escort_attack = 0
        escort_defense = 1
      end
      
      my_power = escort_attack
      
      @log << "Day #{step}: #{encounter[:text]}"
      
      if my_power > (enemy_power * 1.5)
        # Easy win — no losses
        add_rewards(encounter[:rewards])
        @log << "  -> Your forces easily overwhelmed them. Obtained: #{format_rewards(encounter[:rewards])}."
      elsif my_power > enemy_power
        # Win with losses
        loss_ratio = enemy_power.to_f / (my_power + enemy_power)
        losses = [(@survivors * loss_ratio).ceil, 1].max
        losses = [losses, @survivors].min
        @survivors -= losses
        
        add_rewards(encounter[:rewards])
        @log << "  -> Victory, but at a cost. #{losses} escorts were lost. Obtained: #{format_rewards(encounter[:rewards])}."
      else
        # Defeat / Retreat — heavy losses, no spoils
        if @survivors > 0
           loss_pct = 0.3 + rand * 0.4  # 30-70% losses on defeat
           losses = [(@survivors * loss_pct).ceil, 1].max
           @survivors -= losses
           @log << "  -> The enemy was too strong! You retreated, losing #{losses} escorts in the chaos."
        else
           # No escorts left - Main Team takes damage (Fatal)
           # 50% chance to survive if enemy is weak
           if enemy_power < 15 && rand < 0.5
             @log << "  -> The defenseless explorers managed to hide and survive!"
           else
             @main_team_alive = false
             @log << "  -> The defenseless explorers were slaughtered."
           end
        end
      end
    end

    def process_discovery(step)
      discoveries = [
        # Gold
        { 
          rewards: { gold: rand(50..200) }, 
          text: "Your units came across a strange waterfall where the water flowed upwards. Behind it was a magic chest." 
        },
        { 
          rewards: { gold: rand(20..100) }, 
          text: "An abandoned merchant wagon was found by the road." 
        },
        # Land
        { 
          rewards: { land: 1 }, 
          text: "The scouts mapped out a fertile valley, perfect for expansion." 
        },
        { 
          rewards: { land: 2 }, 
          text: "You discovered the ruins of an old outpost that can be reclaimed." 
        },
        # Mana
        { 
          rewards: { mana: rand(20..100) }, 
          text: "A glowing crystal formation hums with energy. Your mage units harvest it." 
        },
        { 
          rewards: { mana: rand(100..300) }, 
          text: "You found a site of ancient magical convergence." 
        },
        # Items / Artifacts (Sold for now)
        { 
          rewards: { gold: 250 }, 
          text: "Buried in the sand, they found a sealed scroll case (sold for gold)." 
        },
        # Units
        {
          rewards: { units: [{ slug: 'militia', amount: rand(10..20) }] },
          text: "A group of wandering refugees offers to join your cause as Militia."
        },
        {
          rewards: { units: [{ slug: 'pikeman', amount: rand(2..5) }] },
          text: "You encounter a small band of mercenaries looking for work."
        }
      ]
      
      discovery = discoveries.sample
      
      add_rewards(discovery[:rewards])
      
      if !discovery[:rewards].empty?
        @log << "Day #{step}: #{discovery[:text]} (+#{format_rewards(discovery[:rewards])})"
      else
        @log << "Day #{step}: #{discovery[:text]}"
      end
    end

    def process_setback(step)
      setbacks = [
        {
          text: "The party got lost in a dense fog, losing precious time.",
          effect: { land: -1 }
        },
        {
          text: "A bridge collapsed, forcing a long detour.",
          effect: { land: -1 }
        },
        {
          text: "The scouts misread the map and led the group in circles.",
          effect: { land: -2 }
        },
        {
          text: "Harsh weather forced the group to hunker down.",
          effect: { land: -1 }
        }
      ]
      
      setback = setbacks.sample
      display = "0"
      
      # Only apply land penalty if we have land to lose
      if setback[:effect][:land]
         current = @resources["land"]
         penalty = setback[:effect][:land]
         
         # Don't drop below 0 mid-calculation
         if current + penalty < 0
           penalty = -current 
         end
         
         @resources["land"] += penalty
         display = penalty.to_s
      end
      
      @log << "Day #{step}: #{setback[:text]} (#{display} Land)"
    end

    def process_uneventful(step)
      texts = [
        "The day was quiet. The troops marched on.",
        "Heavy rain slowed progress, but morale remains high.",
        "Nothing but wilderness as far as the eye can see.",
        "The stars were particularly bright last night.",
        "A minor equipment malfunction caused a delay, but was quickly fixed."
      ]
      @log << "Day #{step}: #{texts.sample}"
    end
    
    def add_rewards(rewards)
      return unless rewards
      
      @resources["gold"] += rewards[:gold].to_i
      @resources["land"] += rewards[:land].to_i
      @resources["mana"] += rewards[:mana].to_i
      
      if rewards[:units]
        rewards[:units].each do |u|
           # Check if we already have this unit type in the rewards list
           found = @resources["units_found"].find { |f| f[:slug] == u[:slug] }
           if found
             found[:amount] += u[:amount]
           else
             @resources["units_found"] << { slug: u[:slug], amount: u[:amount] }
           end
        end
      end
    end
    
    def format_rewards(rewards)
      parts = []
      rewards = rewards.transform_keys(&:to_sym) # Ensure symbol keys
      
      parts << "#{rewards[:gold]} Gold" if rewards[:gold].to_i > 0
      parts << "#{rewards[:land]} Land" if rewards[:land].to_i > 0
      parts << "#{rewards[:mana]} Mana" if rewards[:mana].to_i > 0
      
      if rewards[:units]
        units_str = rewards[:units].map { |u| "#{u[:amount]} #{u[:slug].to_s.titleize}" }.join(", ")
        parts << units_str unless units_str.empty?
      elsif rewards[:units_found]
         # Handle internal structure vs passed structure
         units_str = rewards[:units_found].map { |u| "#{u[:amount]} #{u[:slug].to_s.titleize}" }.join(", ")
         parts << units_str unless units_str.empty?
      end
      
      parts.empty? ? "Nothing" : parts.join(", ")
    end

    def finalize_exploration
      @resources["survivors"] = @survivors
      
      unless @main_team_alive
        @log << "FAILURE: The expedition was wiped out. No one returned."
        # Min rewards for failure
        @resources["land"] = 0
        @resources["gold"] = (@resources["gold"] * 0.1).to_i
        @resources["mana"] = 0
        @resources["units_found"] = []
      else
        @log << "SUCCESS: The expedition has returned. Claim the rewards to reunite with your units."
        
        # Ensure at least 1 land if successful, regardless of loot
        if @resources["land"] <= 0
           @resources["land"] = 1
        end
        
        @log << "  Survivors: #{@survivors} Escorts (Awaiting Claim)"
        @log << "  Total Rewards: #{format_rewards(@resources)}"
      end
      
      @exploration.update!(
        status: :completed,
        events: @log,
        resources_found: @resources
      )

      # Create Notification
      status_text = @main_team_alive ? "Returned" : "Lost"
      Notification.create!(
        user: @exploration.user,
        category: 'exploration',
        content: "Exploration Party #{status_text}: Found #{format_rewards(@resources)}",
        data: { exploration_id: @exploration.id, success: @main_team_alive }
      )
    end
  end
end
