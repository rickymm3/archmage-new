class SpellsController < ApplicationController
  def index
    @user_affinity = current_user.color
    
    # Preload user progress
    @user_spells = current_user.user_spells.index_by(&:spell_id)

    # Load all spells (General + Class specific)
    # Sort: Unlearned first, then by Progress (desc), then Rank, then Name
    @spells = Spell.where(affinity: ['general', @user_affinity])
                   .order(:rank, :affinity, :name)
                   .sort_by do |s| 
                      user_spell = @user_spells[s.id]
                      is_learned = user_spell&.learned ? 1 : 0
                      progress = user_spell&.research_progress || 0
                      
                      [is_learned, -progress, s.rank, s.affinity, s.name]
                   end
    
    @max_mana = current_user.max_mana
    
    if params[:spell_id]
      @selected_spell = @spells.find { |s| s.id == params[:spell_id].to_i }
    end
    
    # Default selection
    @selected_spell ||= @spells.first
  end

  def casting
    @user_affinity = current_user.color
    
    # Load learned spells
    learned_spell_ids = current_user.user_spells.where(learned: true).pluck(:spell_id)
    @spells = Spell.where(id: learned_spell_ids).order(:name)
    
    @user_spells = current_user.user_spells.index_by(&:spell_id)
    @max_mana = current_user.max_mana
    
    if params[:spell_id]
      @selected_spell = @spells.find { |s| s.id == params[:spell_id].to_i }
    else
      @selected_spell = @spells.first
    end
  end

  def research
    spell = Spell.find(params[:spell_id])
    amount = params[:amount].to_i
    
    service = Spells::ResearchService.new(current_user, spell, amount)
    
    if service.call
      message = "Invested #{service.result[:invested]} mana."
      if service.result[:learned]
        message += " You have learned #{spell.name}!"
      end
      redirect_to spells_path(spell_id: spell.id), notice: message
    else
      redirect_to spells_path(spell_id: spell.id), alert: service.errors.join(". ")
    end
  end
  
  def cast
    spell = Spell.find(params[:spell_id])
    amount = params[:amount].to_i
    amount = [amount, spell.mana_cost, 1].max

    service = Spells::CastService.new(current_user, spell, amount: amount)
    
    if service.call
      flash[:notice] = service.result[:success]
    else
      flash[:alert] = service.result[:error]
    end
    
    redirect_to casting_spells_path(spell_id: spell.id)
  end
end

