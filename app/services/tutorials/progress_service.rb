require "ostruct"

module Tutorials
  class ProgressService
    STEPS = %w[
      welcome explore_intro solo_exploration solo_wait keep_intro upgrade_keep
      recruit_intro recruit_explorers send_explorers barbarian_intro
      barbarian_attack magic_intro research_half mana_intro release_mana
      finish_research cast_spell buffs_intro tax_intro collect_taxes
      upkeep_intro pay_troops claim_expedition conclusion completed
    ].freeze

    PASSIVE_STEPS = %w[
      welcome explore_intro keep_intro recruit_intro barbarian_intro magic_intro
      mana_intro buffs_intro tax_intro upkeep_intro conclusion
    ].freeze

    attr_reader :user, :result, :errors

    def initialize(user)
      @user = user
      @result = {}
      @errors = []
    end

    def call(action)
      action = action.to_s
      return fail_with("Tutorial is already complete.") if complete?
      return fail_with("This tutorial step has already been completed.") unless action == current_step

      User.transaction do
        user.lock!
        return fail_with("This tutorial step has already been completed.") unless action == current_step

        ok = PASSIVE_STEPS.include?(action) ? true : perform(action)
        raise ActiveRecord::Rollback unless ok

        advance!
      end

      errors.empty?
    rescue StandardError => e
      Rails.logger.error("Tutorial action failed: #{e.class}: #{e.message}")
      fail_with("The Steward could not complete that step. Please try again.")
    end

    def skip!
      return true if complete?

      User.transaction do
        cleanup_tutorial_expeditions!
        user.update!(
          onboarding_step: "completed",
          onboarding_skipped_at: Time.current,
          onboarding_completed_at: Time.current
        )
      end
      true
    end

    def payload
      step = current_step
      {
        step: step,
        completed: complete?,
        skipped: user.onboarding_skipped_at.present?,
        progress: [STEPS.index(step) || 0, STEPS.length - 1].min,
        total: STEPS.length - 1,
        state: user.onboarding_state || {}
      }
    end

    private

    def current_step
      user.onboarding_step.presence_in(STEPS) || "welcome"
    end

    def complete?
      user.onboarding_completed_at.present? || current_step == "completed"
    end

    def fail_with(message)
      errors << message
      false
    end

    def advance!
      next_step = STEPS.fetch(STEPS.index(current_step) + 1)
      attrs = { onboarding_step: next_step }
      attrs[:onboarding_completed_at] = Time.current if next_step == "completed"
      user.update!(attrs)
    end

    def update_state!(values)
      user.update!(onboarding_state: (user.onboarding_state || {}).merge(values.stringify_keys))
    end

    def perform(action)
      case action
      when "solo_exploration" then start_solo_exploration
      when "solo_wait" then claim_solo_exploration
      when "upgrade_keep" then upgrade_keep
      when "recruit_explorers" then recruit_explorers
      when "send_explorers" then send_explorers
      when "barbarian_attack" then tutorial_barbarian_attack
      when "research_half" then research_half
      when "release_mana" then release_mana
      when "finish_research" then finish_research
      when "cast_spell" then cast_spell
      when "collect_taxes" then collect_taxes
      when "pay_troops" then pay_troops
      when "claim_expedition" then claim_expedition
      else fail_with("Unknown tutorial step.")
      end
    end

    def start_solo_exploration
      return fail_with("Finish your current exploration before beginning the tutorial expedition.") if user.explorations.active.exists?

      exploration = user.explorations.create!(
        quantity: 0,
        started_at: Time.current,
        finishes_at: 5.seconds.from_now,
        status: :active,
        resources_found: { "potential_land" => 1, "tutorial" => true },
        events: ["The Steward's scout slips beyond the border."]
      )
      update_state!(solo_exploration_id: exploration.id, wait_until: exploration.finishes_at.iso8601)
      @result[:message] = "Your scout will return in five seconds."
      true
    end

    def claim_solo_exploration
      exploration = user.explorations.find_by(id: user.onboarding_state["solo_exploration_id"])
      return fail_with("The tutorial expedition could not be found.") unless exploration
      return fail_with("Your scout is still exploring.") if exploration.finishes_at.future?

      unless exploration.claimed?
        exploration.update!(
          status: :completed,
          resources_found: { "land" => 1, "gold" => 0, "mana" => 0, "survivors" => 0, "tutorial" => true },
          events: ["A fertile tract of unclaimed land was mapped safely."]
        )
        return fail_with("The expedition rewards could not be claimed.") unless Explorations::ClaimService.new(exploration).call
      end
      update_state!(wait_until: nil)
      @result[:message] = "Claimed 1 Land."
      true
    end

    def upgrade_keep
      structure = Structure.find_by(slug: "town_center")
      return fail_with("Town Center data is unavailable.") unless structure

      existing = user.user_structures.find_by(structure: structure)
      if existing&.level.to_i >= 2
        @result[:message] = "Your Town Center is already level 2 or higher."
        return true
      end

      service = Town::BuildService.new(user, structure, 1)
      return fail_with(service.errors.full_messages.join(". ")) unless service.call

      @result[:message] = "Town Center upgraded to level 2."
      true
    end

    def recruit_explorers
      explorer = Unit.find_by(slug: "explorer")
      return fail_with("Explorer unit data is unavailable.") unless explorer
      return fail_with("You need 100 gold to recruit the tutorial explorers.") if user.gold < 100

      user.decrement!(:gold, 100)
      holding = user.user_units.find_or_initialize_by(unit: explorer)
      holding.quantity = holding.quantity.to_i + 5
      holding.save!
      @result[:message] = "Five Explorers joined your army instantly."
      true
    end

    def send_explorers
      return fail_with("Finish your current exploration first.") if user.explorations.active.exists?

      explorer = Unit.find_by(slug: "explorer")
      holding = user.user_units.find_by(unit: explorer)
      return fail_with("Five available Explorers are required.") unless holding && holding.available_quantity >= 5

      finish = 25.seconds.from_now
      holding.class.update_counters(holding.id, exploring: 5)
      exploration = user.explorations.create!(
        unit: explorer,
        quantity: 5,
        started_at: Time.current,
        finishes_at: finish,
        status: :active,
        resources_found: { "potential_land" => 3, "tutorial" => true },
        events: ["Five Explorers set out to map the frontier."]
      )
      update_state!(escorted_exploration_id: exploration.id, expedition_wait_until: finish.iso8601)
      @result[:message] = "Your Explorers are searching the frontier."
      true
    end

    def tutorial_barbarian_attack
      militia = Unit.find_by(slug: "militia")
      return fail_with("Militia unit data is unavailable.") unless militia

      holding = user.user_units.find_or_initialize_by(unit: militia)
      holding.quantity = holding.quantity.to_i + 20
      holding.save!
      user.increment!(:gold, 250)
      user.increment!(:land, 2)
      user.update_morale!(70)
      update_state!(tutorial_morale_applied: true)

      item = Item.where(rarity: "common").first || Item.first
      if item
        user_item = user.user_items.find_or_create_by!(item: item)
        user_item.increment!(:quantity, 1)
      end

      @result[:battle_result] = scripted_battle_result(militia)
      @result[:message] = "Victory! You recovered 250 gold, 2 Land#{item ? ", and #{item.name}" : ""}."
      true
    end

    def scripted_battle_result(militia)
      stack = lambda do |name:, initial:, remaining:, attack:, defense:, speed:, unit_type:, element:|
        {
          name: name, initial: initial, remaining: remaining, lost: initial - remaining,
          attack: attack, defense: defense, speed: speed, unit_type: unit_type,
          element: element, hero: nil, hero_alive: nil
        }
      end
      {
        outcome: "attacker",
        land_seized: 2,
        verdict: {
          attacker: { power_start: 40, power_end: 40, power_lost: 0, lost_pct: 0 },
          defender: { power_start: 12, power_end: 0, power_lost: 12, lost_pct: 100 },
          defender_bonus: 1.25, attacker_score: 12, defender_score: 0, decided_by: "annihilation"
        },
        attacker_army: {
          name: user.username,
          stacks: [stack.call(name: militia.name, initial: 20, remaining: 20, attack: militia.attack, defense: militia.defense, speed: militia.speed, unit_type: militia.unit_type, element: militia.element)]
        },
        defender_army: {
          name: "The Broken Tusk Camp",
          stacks: [stack.call(name: "Barbarian Rabble", initial: 4, remaining: 0, attack: 1, defense: 1, speed: 3, unit_type: "infantry", element: "physical")]
        },
        log: [
          "=== BATTLE START ===", "[ATK] Your militia advance on the Broken Tusk Camp.",
          "[DEF] The barbarian rabble breaks beneath the charge.",
          "=== BATTLE END ===", "Winner: ATTACKER (The settlement was routed.)"
        ],
        events: []
      }
    end

    def meditation
      Spell.find_by(name: "Meditation")
    end

    def meditation_progress
      spell = meditation
      return nil unless spell
      user.user_spells.find_or_initialize_by(spell: spell)
    end

    def research_half
      spell = meditation
      return fail_with("Meditation is unavailable.") unless spell
      if user.user_spells.exists?(spell: spell, learned: true)
        @result[:message] = "You have already learned Meditation."
        return true
      end
      amount = (spell.research_cost / 2.0).ceil
      return fail_with("You need #{amount} mana.") if user.mana < amount

      target = meditation_progress
      user.decrement!(:mana, amount)
      target.update!(research_progress: amount, learned: false, rolled_at: Time.current)
      @result[:message] = "Meditation research is halfway complete."
      true
    end

    def release_mana
      user.update!(last_mana_recharge_at: 2.hours.ago)
      release = Treasury::ChannelMana.new(user).call
      @result[:message] = release.message
      true
    end

    def finish_research
      spell = meditation
      target = meditation_progress
      return fail_with("Meditation research is unavailable.") unless spell && target&.persisted?
      if target.learned?
        @result[:message] = "You have already learned Meditation."
        return true
      end

      remaining = spell.research_cost - target.research_progress.to_i
      return fail_with("You need #{remaining} mana.") if user.mana < remaining
      user.decrement!(:mana, remaining)
      target.update!(research_progress: spell.research_cost, learned: true)
      @result[:message] = "You learned Meditation."
      true
    end

    def cast_spell
      spell = meditation
      return fail_with("Meditation is unavailable.") unless spell
      service = Spells::CastService.new(user, spell, amount: spell.mana_cost)
      return fail_with(service.result[:error]) unless service.call

      @result[:message] = service.result[:success]
      true
    end

    def collect_taxes
      user.update!(tax_cooldown: nil)
      service = Treasury::TaxationService.new(user)
      return fail_with(service.errors.join(". ")) unless service.collect_tax(:standard)

      @result[:message] = "Standard taxes collected."
      true
    end

    def pay_troops
      upkeep = user.total_army_upkeep
      missing = [100 - user.current_base_morale, 0].max
      amount = [(missing / 100.0 * upkeep).ceil, 1].max
      service = Treasury::MoraleService.new(user)
      return fail_with(service.errors.join(". ")) unless service.pay_upkeep(amount)

      update_state!(tutorial_morale_applied: false)
      @result[:message] = "The army has been paid and morale restored."
      true
    end

    def claim_expedition
      exploration = user.explorations.find_by(id: user.onboarding_state["escorted_exploration_id"])
      return fail_with("The escorted expedition could not be found.") unless exploration

      unless exploration.claimed?
        exploration.update!(
          finishes_at: [exploration.finishes_at, Time.current].min,
          status: :completed,
          resources_found: { "land" => 2, "gold" => 75, "mana" => 0, "survivors" => 5, "tutorial" => true },
          events: ["The Explorers mapped two safe tracts and returned with 75 gold."]
        )
        return fail_with("The expedition rewards could not be claimed.") unless Explorations::ClaimService.new(exploration).call
      end
      @result[:message] = "Your Explorers returned safely with 2 Land and 75 gold."
      true
    end

    def cleanup_tutorial_expeditions!
      state = user.onboarding_state || {}
      user.update_morale!(100) if state["tutorial_morale_applied"]
      ids = [state["solo_exploration_id"], state["escorted_exploration_id"]].compact
      user.explorations.where(id: ids, status: :active).find_each do |exploration|
        if exploration.unit && exploration.quantity.positive?
          holding = user.user_units.find_by(unit: exploration.unit)
          holding.update!(exploring: [holding.exploring.to_i - exploration.quantity, 0].max) if holding
        end
        exploration.update!(status: :failed)
      end
    end
  end
end
