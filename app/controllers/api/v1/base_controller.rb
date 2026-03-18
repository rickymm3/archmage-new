module Api
  module V1
    class BaseController < ActionController::API
      before_action :authenticate_api_user!

      private

      def authenticate_api_user!
        token = request.headers["Authorization"]&.split(" ")&.last
        @current_user = User.find_by(auth_token: token) if token

        unless @current_user
          render json: { error: "Unauthorized: Invalid or missing token" }, status: :unauthorized
        end
      end

      def current_user
        @current_user
      end
    end
  end
end
