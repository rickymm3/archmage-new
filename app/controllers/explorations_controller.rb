class ExplorationsController < ApplicationController
  def index
    @active_exploration = current_user.explorations.active.first
    @completed_explorations = current_user.explorations.completed.order(finishes_at: :desc)
    @claimed_explorations = current_user.explorations.claimed.order(updated_at: :desc).limit(5)
    
    # Check if active is done
    if @active_exploration && @active_exploration.finishes_at <= Time.current
      Explorations::ProcessService.new(@active_exploration).call
      @active_exploration = nil
      @completed_explorations = current_user.explorations.completed.order(finishes_at: :desc)
    end
    
    # Data for the form
    @available_units = current_user.user_units.includes(:unit).select { |uu| uu.available_quantity > 0 }
  end

  def create
    @service = Explorations::StartService.new(current_user, exploration_params)
    
    if @service.call
      redirect_to explorations_path, notice: "Exploration party sent out!"
    else
      redirect_to explorations_path, alert: @service.errors.join(". ")
    end
  end

  def claim
    @exploration = current_user.explorations.completed.find(params[:id])
    
    service = Explorations::ClaimService.new(@exploration)
    if service.call
       redirect_to explorations_path, notice: "Exploration rewards claimed!"
    else
       redirect_to explorations_path, alert: "Could not claim rewards."
    end
  end

  private

  def exploration_params
    params.require(:exploration).permit(:unit_id, :quantity)
  end
end
