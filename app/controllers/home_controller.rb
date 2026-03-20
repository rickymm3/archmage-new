class HomeController < ApplicationController
  allow_unauthenticated_access

  def index
    if authenticated?
      @active_exploration = current_user.explorations.active.first

      # Auto-process finished exploration
      if @active_exploration && @active_exploration.finishes_at <= Time.current
        Explorations::ProcessService.new(@active_exploration).call
        @active_exploration = nil
      end

      @completed_explorations = current_user.explorations.completed.order(finishes_at: :desc)
    end
  end
end
