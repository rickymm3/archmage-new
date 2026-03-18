class Treasury::ManaController < ApplicationController
  def recharge
    service = Treasury::ChannelMana.new(current_user)
    result = service.call

    if result.notification
      flash[:notice] = "Breach! Check your notifications."
      # Optionally, we could put the ID in session to open it automatically?
      # flash[:open_notification_id] = result.notification.id 
    end

    if result.success?
      flash[result.type] = result.message
      redirect_back(fallback_location: treasury_index_path)
    else
      redirect_back(fallback_location: treasury_index_path, alert: result.message)
    end
  end

  def status
  end
end
