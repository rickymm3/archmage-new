class ArmyController < ApplicationController
  def show
    # Fetch all known units for display purposes
    # For now, we'll fetch all units in the game so users can see what is available
    @all_game_units = Unit.order(:unit_type, :attack)
    
    # User's actual holdings (mapped by unit_id)
    # Reload association to ensure fresh data after actions like disband
    @user_holdings = current_user.user_units.reload.index_by(&:unit_id)

    # Categorize for the view
    @active_units = []
    @other_units = []

    @all_game_units.each do |unit|
      holding = @user_holdings[unit.id]
      qty = holding&.quantity || 0
      
      if qty > 0
        @active_units << unit
      else
        @other_units << unit
      end
    end
    
    # Selection logic
    if params[:unit_id]
        @selected_unit = Unit.find(params[:unit_id])
    else
        # Default to first active unit, or just the first unit available
        @selected_unit = @active_units.first || @all_game_units.first
    end
    
    # Stats (Only count what user actually has)
    all_holdings = @user_holdings.values
    @total_quantity = all_holdings.sum(&:quantity)
    @total_upkeep = all_holdings.sum { |uu| uu.quantity * uu.unit.upkeep_cost }
    
    # Safe Mana Upkeep for holding vs unit
    @total_mana_upkeep = all_holdings.sum { |uu| uu.quantity * (uu.unit.respond_to?(:mana_upkeep) ? (uu.unit.mana_upkeep || 0) : 0) }
    
    @total_attack = all_holdings.sum { |uu| uu.quantity * uu.unit.attack }
    @total_defense = all_holdings.sum { |uu| uu.quantity * uu.unit.defense }
    
    # Morale
    @morale_service = Treasury::MoraleService.new(current_user)
    @daily_upkeep = @morale_service.daily_upkeep
    @current_morale = current_user.current_morale
    @last_calculated_at = Time.current
    @decay_rate = 100.0 / 1.day.to_i
  end
  
  def pay_upkeep
    amount = params[:amount].to_i
    service = Treasury::MoraleService.new(current_user)
    
    if service.pay_upkeep(amount)
      redirect_to army_path, notice: "Paid upkeep."
    else
      redirect_to army_path, alert: service.errors.to_sentence
    end
  end

  def disband
    unit_id = params[:unit_id]
    quantity = params[:quantity].to_i
    
    user_unit = current_user.user_units.includes(:unit).find_by(unit_id: unit_id)
    
    if user_unit
      # Summoned units cannot be disbanded
      if !user_unit.unit.recruitable && user_unit.unit.unit_type != 'hero'
        redirect_to army_path(unit_id: unit_id), alert: "Summoned units cannot be disbanded. They are bound to your kingdom."
        return
      end

      available = user_unit.quantity - user_unit.garrison
      
      if quantity > 0 && quantity <= available
        user_unit.quantity -= quantity
        
        if user_unit.quantity == 0 && user_unit.garrison == 0
          user_unit.destroy
        else
          user_unit.save!
        end
         
        redirect_to army_path(unit_id: unit_id), notice: "Disbanded #{quantity} #{user_unit.unit.name.pluralize(quantity)}."
      elsif quantity > available
         redirect_to army_path(unit_id: unit_id), alert: "Cannot disband more units than are currently active (some may be garrisoned)."
      else
        redirect_to army_path(unit_id: unit_id), alert: "Invalid quantity to disband."
      end
    else
      redirect_to army_path, alert: "Unit not found in your army."
    end
  end

  def garrison
    @user_units = current_user.user_units.includes(:unit, :assigned_hero).where('quantity > 0').order('units.id')
    @all_garrison_units = current_user.user_units.index_by(&:unit_id)
    
    # Fetch user's heroes
    hero_unit_ids = current_user.user_units.joins(:unit).where(units: { unit_type: 'hero' }).where('quantity > 0').pluck(:unit_id)
    @heroes = Unit.where(id: hero_unit_ids)
    @hero_assignments = current_user.user_units.where(hero_id: hero_unit_ids).index_by(&:hero_id)
    
    # Only Instant spells can be defensive triggers usually (like Fireball, not Summon Skeleton)
    # But for now, let's allow all spells that aren't 'Summoning' or maybe just all?
    # Schema has `spell_type`.
    @available_spells = current_user.spells.where(spell_type: ['Battle', 'Enchantment']).order(:name)
  end
  
  def assign_hero
    user_unit_group = current_user.user_units.find_by(unit_id: params[:unit_id])
    
    if user_unit_group && params[:hero_id].present?
       # Assigning
       hero = Unit.find_by(id: params[:hero_id])
       if hero && hero.unit_type == 'hero'
          # Check ownership
          if current_user.user_units.where(unit_id: hero.id).where('quantity > 0').exists?
             if user_unit_group.update(hero_id: hero.id)
                flash[:notice] = "#{hero.name} assigned to #{user_unit_group.unit.name}."
             else
                flash[:alert] = user_unit_group.errors.full_messages.join(", ")
             end
          else
             flash[:alert] = "You do not own this hero."
          end
       else
          flash[:alert] = "Invalid hero selected."
       end
    elsif user_unit_group
       # Removing
       user_unit_group.update(hero_id: nil)
       flash[:notice] = "Hero removed from #{user_unit_group.unit.name}."
    else
       flash[:alert] = "Unit group not found."
    end
    
    redirect_to garrison_army_path
  end

  def update_garrison
    permitted = params.require(:user).permit(
      :active_defense_spell_id, 
      :auto_reinforce,
      user_units_attributes: [:id, :garrison]
    )
    
    if current_user.update(permitted)
      redirect_to garrison_army_path, notice: "Defenses updated successfully."
    else
      @user_units = current_user.user_units.includes(:unit).where('quantity > 0').order('units.id')
      @available_spells = current_user.spells.where(spell_type: ['Battle', 'Enchantment']).order(:name)
      render :garrison, status: :unprocessable_entity
    end
  end

  def index
    show
    render :show
  end
end
