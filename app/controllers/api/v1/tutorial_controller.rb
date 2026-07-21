module Api
  module V1
    class TutorialController < BaseController
      def show
        render json: { tutorial: service.payload }
      end

      def advance
        if service.call(params[:step])
          render json: { tutorial: service.payload, result: service.result }
        else
          render json: { errors: service.errors, tutorial: service.payload }, status: :unprocessable_entity
        end
      end

      def skip
        service.skip!
        render json: { tutorial: service.payload }
      end

      private

      def service
        @service ||= Tutorials::ProgressService.new(current_user)
      end
    end
  end
end
