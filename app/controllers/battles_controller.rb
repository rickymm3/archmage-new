class BattlesController < ApplicationController
  
  def index
    # Ensure scouting data exists, refresh if stale (10 mins)
    last_scouted = current_user.last_scouted_at
    if last_scouted.nil? || last_scouted < 10.minutes.ago
       Battle::ScoutingService.new(current_user).call
       current_user.reload
    end
    
    @targets = current_user.scouted_targets || []
    @can_refresh = current_user.last_scouted_at < 5.minutes.ago
  end
  
  def scout
    Battle::ScoutingService.new(current_user).call # Forces refresh
    redirect_to battles_path, notice: "Scouting report updated."
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
