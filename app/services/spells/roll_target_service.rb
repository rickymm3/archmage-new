module Spells
  class RollTargetService
    REROLL_COST = 25 # flat mana, every reroll

    RANK_WEIGHT_BASE = 100
    RANK_WEIGHT_RATIO = 0.55

    attr_reader :user, :affinity, :errors, :result

    def initialize(user, affinity, reroll: false)
      @user = user
      @affinity = affinity.to_s
      @reroll = reroll
      @errors = []
      @result = {}
    end

    def self.weight_for_rank(rank)
      [(RANK_WEIGHT_BASE * (RANK_WEIGHT_RATIO**(rank - 1))).round, 1].max
    end

    # The user's active research target for `affinity`, or nil.
    # Backward-compat: a row counts as "is a target" if it has rolled_at set
    # OR has research_progress > 0 (covers pre-migration partial-progress rows).
    def self.current_target_for(user, affinity)
      user.user_spells
          .joins(:spell)
          .where(spells: { affinity: affinity }, learned: false)
          .where("user_spells.rolled_at IS NOT NULL OR user_spells.research_progress > 0")
          .order(rolled_at: :desc)
          .first
    end

    def call
      existing = self.class.current_target_for(@user, @affinity)

      if @reroll
        unless existing
          @errors << "You have no active research target to reroll."
          return false
        end
        if existing.research_progress.to_i > 0
          @errors << "You've already invested mana in #{existing.spell.name} — finish it before rerolling."
          return false
        end
        if @user.mana < REROLL_COST
          @errors << "You need #{REROLL_COST} mana to reroll."
          return false
        end
      elsif existing
        @errors << "You already have an active research target for this affinity."
        return false
      end

      excluded_id = existing&.spell_id
      candidates = candidate_spells(excluded_id)

      if candidates.empty?
        @errors << "No spells left to research for this affinity."
        return false
      end

      picked = weighted_pick(candidates)

      ActiveRecord::Base.transaction do
        if @reroll
          @user.decrement!(:mana, REROLL_COST)
          existing.destroy!
        end

        user_spell = @user.user_spells.create!(
          spell: picked,
          research_progress: 0,
          learned: false,
          rolled_at: Time.current
        )
        @result[:spell] = picked
        @result[:user_spell] = user_spell
        @result[:reroll_cost] = @reroll ? REROLL_COST : 0
      end

      true
    rescue => e
      @errors << e.message
      false
    end

    private

    def candidate_spells(excluded_id)
      learned_ids = @user.user_spells.where(learned: true).pluck(:spell_id)
      ids = Spell.accessible_ids(@user, @affinity) - learned_ids
      ids -= [excluded_id] if excluded_id
      Spell.where(id: ids).to_a
    end

    def weighted_pick(spells)
      weighted = spells.map { |s| [s, self.class.weight_for_rank(s.rank)] }
      total_weight = weighted.sum { |_, w| w }
      roll = rand(total_weight)
      cumulative = 0
      weighted.each do |spell, w|
        cumulative += w
        return spell if roll < cumulative
      end
      weighted.last.first
    end
  end
end
