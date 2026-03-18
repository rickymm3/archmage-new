module Api
  module V1
    class NotificationsController < BaseController
      def index
        notifications = current_user.notifications.recent.limit(params[:limit] || 50)

        render json: {
          notifications: notifications.map { |n| serialize_notification(n) },
          unread_count: current_user.notifications.unread.count
        }
      end

      def show
        notification = current_user.notifications.find(params[:id])
        notification.update(read_at: Time.current) unless notification.read?

        data = serialize_notification(notification)
        data[:battle_log] = notification.data["log"] if notification.category == "battle" && notification.data["log"]

        render json: { notification: data }
      end

      def mark_all_read
        Notification.mark_all_read!(current_user)
        render json: { message: "All marked as read" }
      end

      private

      def serialize_notification(notification)
        {
          id: notification.id,
          title: notification.title,
          content: notification.content,
          category: notification.category,
          read: notification.read?,
          read_at: notification.read_at,
          created_at: notification.created_at,
          data: notification.data
        }
      end
    end
  end
end
