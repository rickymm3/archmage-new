require "test_helper"

module Tutorials
  class ProgressServiceTest < ActiveSupport::TestCase
    setup do
      @user = users(:one)
      @user.explorations.destroy_all
      @user.user_units.destroy_all
      @user.user_spells.destroy_all
      @user.active_spells.destroy_all
      @user.update!(
        onboarding_step: "welcome",
        onboarding_state: {},
        onboarding_completed_at: nil,
        onboarding_skipped_at: nil,
        gold: 10_000,
        mana: 500,
        land: 20,
        morale: 100,
        morale_updated_at: Time.current,
        tax_cooldown: nil
      )

      @town_center = Structure.find_or_create_by!(slug: "town_center") do |structure|
        structure.name = "Town Center"
        structure.description = "The heart of the kingdom."
        structure.requirements = { "gold" => 1500 }
        structure.level_based = true
        structure.max_level = 10
        structure.land_cost = 0
      end
      @user.user_structures.find_or_create_by!(structure: @town_center).update!(level: 1, quantity: 1)

      @explorer = Unit.find_or_create_by!(slug: "explorer") do |unit|
        unit.name = "Explorer"
        unit.description = "Swift frontier scout."
        unit.requirements = { "gold" => 20, "barracks_level" => 1 }
        unit.upkeep_cost = 10
        unit.mana_upkeep = 0
        unit.power = 2
        unit.attack = 1
        unit.defense = 0
        unit.speed = 20
        unit.unit_type = "infantry"
        unit.element = "nature"
        unit.recruitable = true
      end

      @meditation = Spell.find_or_create_by!(name: "Meditation") do |spell|
        spell.description = "Improves mana production."
        spell.rank = 1
        spell.affinity = "general"
        spell.mana_cost = 250
        spell.research_cost = 200
        spell.spell_type = "self"
        spell.cost_resource = "gold"
        spell.configuration = { "stat_target" => "mana_production", "base_magnitude" => 30, "duration" => 7200 }
      end
    end

    test "walkthrough completes once and grants the scripted rewards" do
      advance "welcome"
      advance "explore_intro"
      advance "solo_exploration"
      travel 6.seconds do
        advance "solo_wait"
      end

      advance "keep_intro"
      advance "upgrade_keep"
      advance "recruit_intro"
      advance "recruit_explorers"
      advance "send_explorers"
      advance "barbarian_intro"
      advance "barbarian_attack"
      advance "magic_intro"
      advance "research_half"
      advance "mana_intro"
      advance "release_mana"
      advance "finish_research"
      advance "cast_spell"
      advance "buffs_intro"
      advance "tax_intro"
      advance "collect_taxes"
      advance "upkeep_intro"
      advance "pay_troops"
      advance "claim_expedition"
      advance "conclusion"

      @user.reload
      assert_equal "completed", @user.onboarding_step
      assert @user.onboarding_completed_at.present?
      assert_equal 25, @user.land
      assert_equal 5, @user.user_units.find_by!(unit: @explorer).quantity
      assert_equal 20, @user.user_units.find_by!(unit: units(:one)).quantity
      assert @user.user_spells.find_by!(spell: @meditation).learned?
      assert @user.active_spells.joins(:spell).exists?(spells: { name: "Meditation" })

      replay = ProgressService.new(@user)
      assert_not replay.call("barbarian_attack")
      assert_equal 20, @user.reload.user_units.find_by!(unit: units(:one)).quantity
    end

    test "skipping releases units locked by a tutorial expedition" do
      holding = @user.user_units.create!(unit: @explorer, quantity: 5, exploring: 5, garrison: 0)
      expedition = @user.explorations.create!(
        unit: @explorer, quantity: 5, status: :active,
        started_at: Time.current, finishes_at: 1.hour.from_now,
        resources_found: { "tutorial" => true }
      )
      @user.update!(
        onboarding_step: "barbarian_intro",
        onboarding_state: { "escorted_exploration_id" => expedition.id }
      )

      assert ProgressService.new(@user).skip!
      assert_equal 0, holding.reload.exploring
      assert expedition.reload.failed?
      assert @user.reload.onboarding_skipped_at.present?
    end

    private

    def advance(step)
      service = ProgressService.new(@user.reload)
      assert service.call(step), "#{step} failed: #{service.errors.join(', ')}"
    end
  end
end
