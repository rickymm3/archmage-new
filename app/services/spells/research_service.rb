module Spells
  class ResearchService
    attr_reader :user, :spell, :amount, :errors, :result

    def initialize(user, spell, amount)
      @user = user
      @spell = spell
      @amount = amount.to_i
      @errors = []
      @result = {}
    end

    def call
      if @amount <= 0
        @errors << "You must invest at least 1 mana."
        return false
      end

      if @user.mana < @amount
        @errors << "You do not have enough mana."
        return false
      end

      # Affinity check: allow all affinities but cap non-native at 8 spells
      is_native = @spell.affinity == 'general' || @spell.affinity == @user.color
      unless is_native
        unless Spell.accessible_ids(@user, @spell.affinity).include?(@spell.id)
          @errors << "You can only research the first 8 spells of other affinities."
          return false
        end
      end

      # Must be your currently rolled research target for this affinity —
      # spells are no longer picked directly, only rolled (see
      # Spells::RollTargetService). This is the enforcement point now that
      # there's no UI path to pick an arbitrary spell.
      target = Spells::RollTargetService.current_target_for(@user, @spell.affinity)
      unless target && target.spell_id == @spell.id
        @errors << "#{@spell.name} is not your current research target for this affinity. Roll one first."
        return false
      end

      user_spell = @user.user_spells.find_or_initialize_by(spell: @spell)

      if user_spell.learned?
        @errors << "You have already learned this spell."
        return false
      end
      
      needed = @spell.research_cost - (user_spell.research_progress || 0)
      invested = [@amount, needed].min
      
      ActiveRecord::Base.transaction do
        @user.decrement!(:mana, invested)
        
        user_spell.research_progress = (user_spell.research_progress || 0) + invested
        if user_spell.research_progress >= @spell.research_cost
          user_spell.learned = true
          @result[:learned] = true
        end
        
        user_spell.save!
        @result[:invested] = invested
        @result[:progress] = user_spell.research_progress
      end
      
      true
    rescue => e
      @errors << e.message
      false
    end
  end
end
