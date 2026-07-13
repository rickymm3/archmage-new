class BattlesController < ApplicationController
  
  def index
    targeting = Battle::TargetingService.new(current_user)
    @targets = targeting.targets
    @range = targeting.range
  end

  def scout
    redirect_to battles_path, notice: "Targets are always live now."
  end
  
  def new
    @target = User.find_by(id: params[:target_id])
    
    if @target.nil? || @target.id == current_user.id
      redirect_to battles_path, alert: "Invalid target."
      return
    end
    
    if @target.under_protection?
       redirect_to battles_path, alert: "Target is under magical protection."
       return
    end
    
    @user_units = current_user.user_units.includes(:unit).where('quantity > 0')
    @available_heroes = current_user.user_units.joins(:unit).where(units: { unit_type: 'hero' }).where('quantity > 0')
  end
  
  def create
    service = Battle::ResolutionService.new(
      attacker_id: current_user.id,
      defender_id: params[:target_id],
      unit_allocations: params[:units] || {},
      hero_allocations: params[:heroes] || {}
    )
    
    result = service.call
    
    if result.success?
      @battle_result = result
      render :result
    else
      flash[:alert] = "Battle could not be initiated: #{result.error}"
      redirect_to battles_path
    end
  end
end
