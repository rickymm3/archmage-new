class ActiveSpellsController < ApplicationController
  def index
    @active_spells = current_user.active_spells.includes(:spell)
    @sustained_spells = current_user.user_spells.where(active: true).includes(:spell)
  end

  def destroy
    # If type is sustained, we are looking at user_spells table
    if params[:type] == 'sustained'
      user_spell = current_user.user_spells.find(params[:id])
      
      if user_spell.update(active: false)
        flash[:notice] = "Spell deactivated. Mana restored."
      else
        flash[:alert] = "Could not deactivate spell."
      end
    
    else
      # Default is ActiveSpell table (timed enchantments)
      active_spell = current_user.active_spells.find(params[:id])
      active_spell.destroy
      flash[:notice] = "Enchantment dispelled."
    end
    
    redirect_to active_spells_path
  end
end
