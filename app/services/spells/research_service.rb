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
        # Check if this spell is within the first 8 of its affinity
        affinity_spells = Spell.where(affinity: @spell.affinity).order(:rank, :name).limit(8).pluck(:id)
        unless affinity_spells.include?(@spell.id)
          @errors << "You can only research the first 8 spells of other affinities."
          return false
        end
      end

      # Linear unlock: previous spell in same affinity must be learned
      affinity_spells_ordered = Spell.where(affinity: @spell.affinity).order(:rank, :name).to_a
      spell_index = affinity_spells_ordered.index { |s| s.id == @spell.id }
      if spell_index && spell_index > 0
        prev_spell = affinity_spells_ordered[spell_index - 1]
        prev_learned = @user.user_spells.find_by(spell_id: prev_spell.id)&.learned?
        unless prev_learned
          @errors << "You must learn #{prev_spell.name} first."
          return false
        end
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
