class NotificationsController < ApplicationController
  def index
    @notifications = current_user.notifications.recent.limit(50)
  end

  def show
    @notification = current_user.notifications.find(params[:id])
    @notification.update(read_at: Time.current) unless @notification.read?
    
    # Check if this is a battle log
    if @notification.category == 'battle' && @notification.data['log']
       @battle_log = @notification.data['log']
    end
  end
  
  def mark_all_read
    Notification.mark_all_read!(current_user)
    redirect_back fallback_location: notifications_path, notice: "All marked as read."
  end
end
