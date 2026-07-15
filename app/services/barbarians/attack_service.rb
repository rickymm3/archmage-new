module Barbarians
  class AttackService
    def initialize(user:, settlement_id:, unit_allocations:)
      @user = user
      @settlement = BarbarianSettlement.find(settlement_id)

      raw = unit_allocations.respond_to?(:to_unsafe_h) ? unit_allocations.to_unsafe_h : unit_allocations
      @unit_allocations = raw.to_h.transform_keys(&:to_i).transform_values(&:to_i)
    end

    def call
      @settlement.respawn_if_ready!
      return failed("This settlement is regrouping and cannot be attacked yet.") if @settlement.on_cooldown?

      attacker_stacks = prepare_attacker_stacks
      return failed("No valid units selected.") if attacker_stacks.blank?

      defender_stacks = build_defender_stacks(@settlement)

      calculator = Battle::CalculatorService.new(
        attacker: { name: @user.username, stacks: attacker_stacks },
        defender: { name: @settlement.name, stacks: defender_stacks }
      )
      result = calculator.call
      loot = nil

      ActiveRecord::Base.transaction do
        apply_casualties(result.attacker_army)

        if result.winner == :attacker
          loot = roll_loot(@settlement)
          grant_loot!(loot)
          @settlement.mark_defeated!
        end
        notify_result(result, loot)
      end

      OpenStruct.new(
        success?: true,
        winner: result.winner,
        land_seized: 0,
        log: result.log,
        events: result.events,
        verdict: result.verdict,
        attacker_army: result.attacker_army,
        defender_army: result.defender_army,
        loot: loot
      )
    rescue ActiveRecord::RecordNotFound
      failed("Settlement not found.")
    end

    private

    def failed(message)
      OpenStruct.new(success?: false, error: message)
    end

    # Deliberately not reusing Battle::ResolutionService#prepare_attacker_stacks
    # — that method also wires hero_allocations, which barbarian attacks don't
    # support in v1 (scope cut). This is a smaller, self-contained subset.
    def prepare_attacker_stacks
      stacks = []
      @unit_allocations.each do |unit_id, qty|
        next if qty <= 0
        uu = @user.user_units.find_by(unit_id: unit_id)
        return nil if uu.nil? || uu.available_quantity < qty

        stacks << {
          unit_id: uu.unit.id,
          unit_name: uu.unit.name,
          quantity: qty,
          attack: uu.unit.attack,
          defense: uu.unit.defense,
          speed: uu.unit.speed,
          type: uu.unit.unit_type,
          element: uu.unit.element,
          hero: nil
        }
      end
      return nil if stacks.empty?

      Battle::EquipmentBonus.apply!(@user, stacks)
    end

    def build_defender_stacks(settlement)
      total = settlement.power_target
      raider_power = (total * 0.65).round
      skirmisher_power = total - raider_power

      raider_atk = 4 + settlement.level * 2
      raider_def = 5 + settlement.level * 2
      skirmisher_atk = 6 + settlement.level * 2
      skirmisher_def = 2 + settlement.level

      [
        {
          unit_name: "#{settlement.name} Raiders",
          quantity: [(raider_power / (raider_atk + raider_def).to_f).round, 1].max,
          attack: raider_atk, defense: raider_def, speed: 6,
          type: 'infantry', element: settlement.element,
          abilities: { 'taunt' => true }
        },
        {
          unit_name: "#{settlement.name} Skirmishers",
          quantity: [(skirmisher_power / (skirmisher_atk + skirmisher_def).to_f).round, 1].max,
          attack: skirmisher_atk, defense: skirmisher_def, speed: 11,
          type: 'ranged', element: settlement.element
        }
      ]
    end

    def apply_casualties(army)
      army.stacks.each do |stack|
        loss = stack.initial_quantity - stack.quantity
        next if loss <= 0

        uu = @user.user_units.find_by(unit_id: stack.unit_id)
        next unless uu

        new_qty = [uu.quantity - loss, 0].max
        uu.update!(quantity: new_qty, garrison: [uu.garrison, new_qty].min)
      end
    end

    def roll_loot(settlement)
      weights = settlement.rarity_weights
      roll = rand(weights.values.sum)
      cumulative = 0
      rarity = weights.find { |_, w| (cumulative += w) > roll }&.first || :common

      candidates = Item.where(rarity: rarity)
      candidates = Item.where(rarity: :common) if candidates.empty?
      item = candidates.sample
      gold = (settlement.level * 40 * rand(0.8..1.3)).round
      { item: item, gold: gold }
    end

    def grant_loot!(loot)
      @user.grant_resources!('gold' => loot[:gold])
      if loot[:item]
        ui = @user.user_items.find_or_create_by(item: loot[:item])
        ui.increment!(:quantity, 1)
      end
    end

    def notify_result(result, loot)
      if result.winner == :attacker
        Notification.create!(
          user: @user,
          title: "Victory: #{@settlement.name} Sacked!",
          content: "You defeated #{@settlement.name} (Lv.#{@settlement.level}) and looted #{loot[:gold]} gold" \
                   "#{loot[:item] ? " and a #{loot[:item].name}" : ''}.",
          category: "barbarian",
          data: {
            settlement_id: @settlement.id, winner: 'attacker', log: result.log, events: result.events, verdict: result.verdict,
            attacker_army: result.attacker_army.to_summary, defender_army: result.defender_army.to_summary,
            loot: { gold: loot[:gold], item_name: loot[:item]&.name, item_rarity: loot[:item]&.rarity }
          }
        )
      else
        Notification.create!(
          user: @user,
          title: "Defeat: #{@settlement.name} Held",
          content: "Your assault on #{@settlement.name} (Lv.#{@settlement.level}) failed. Your forces suffered casualties.",
          category: "barbarian",
          data: {
            settlement_id: @settlement.id, winner: 'defender', log: result.log, events: result.events, verdict: result.verdict,
            attacker_army: result.attacker_army.to_summary, defender_army: result.defender_army.to_summary
          }
        )
      end
    end
  end
end
