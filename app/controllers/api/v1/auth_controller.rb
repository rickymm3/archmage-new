module Api
  module V1
    class AuthController < BaseController
      skip_before_action :authenticate_api_user!, only: [ :login, :register ]

      def login
        user = User.authenticate_by(
          email_address: params[:email],
          password: params[:password]
        )

        if user
          user.regenerate_auth_token
          render json: { token: user.auth_token, user: serialize_user(user) }
        else
          render json: { error: "Invalid email or password" }, status: :unauthorized
        end
      end

      def register
        user = User.new(
          username: params[:username],
          email_address: params[:email],
          password: params[:password],
          password_confirmation: params[:password_confirmation],
          color: params[:color]
        )

        if user.save
          user.regenerate_auth_token
          render json: { token: user.auth_token, user: serialize_user(user) }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def logout
        current_user.update!(auth_token: nil)
        render json: { message: "Logged out" }
      end

      def me
        render json: { user: serialize_user(current_user) }
      end

      def update_kingdom_name
        name = params[:kingdom_name].to_s.strip

        if name.length < 3 || name.length > 15
          return render json: { error: "Kingdom name must be 3-15 characters" }, status: :unprocessable_entity
        end

        unless name.match?(/\A[a-zA-Z0-9 ]+\z/)
          return render json: { error: "Kingdom name can only contain letters, numbers, and spaces" }, status: :unprocessable_entity
        end

        # Charge 100 gold if user already has a kingdom name set
        if current_user.kingdom_name.present?
          if current_user.gold < 100
            return render json: { error: "Not enough gold. Changing your kingdom name costs 100 gold" }, status: :unprocessable_entity
          end
          current_user.gold -= 100
        end

        current_user.kingdom_name = name

        if current_user.save
          render json: { user: serialize_user(current_user), message: "Kingdom name updated!" }
        else
          render json: { error: current_user.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      private

      def serialize_user(user)
        {
          id: user.id,
          username: user.username,
          kingdom_name: user.display_kingdom_name,
          has_kingdom_name: user.kingdom_name.present?,
          email: user.email_address,
          color: user.color,
          affinity: user.affinity.name,
          gold: user.gold,
          mana: user.mana,
          land: user.land,
          morale: user.respond_to?(:current_morale) ? user.current_morale : user.morale,
          net_power: user.net_power,
          protection_expires_at: user.protection_expires_at,
          under_protection: user.under_protection?
        }
      end
    end
  end
end
