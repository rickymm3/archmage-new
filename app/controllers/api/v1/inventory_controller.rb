module Api
  module V1
    class InventoryController < BaseController
      def index
        user_items = current_user.user_items.includes(:item).where("quantity > 0")

        equipped = %w[weapon armor accessory].index_with do |type|
          ui = user_items.find { |x| x.equipped? && x.item.item_type == type }
          ui ? serialize_user_item(ui) : nil
        end

        render json: {
          gold: current_user.gold,
          equipped: equipped,
          inventory: user_items.map { |ui| serialize_user_item(ui) }
        }
      end

      def equip
        user_item = current_user.user_items.find(params[:id])
        service = Items::EquipService.new(current_user, user_item)

        if service.call
          render json: { message: "#{user_item.item.name} equipped.", user_item: serialize_user_item(user_item.reload) }
        else
          render json: { error: service.result[:message] }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Item not found" }, status: :not_found
      end

      def unequip
        user_item = current_user.user_items.find(params[:id])
        user_item.update!(equipped: false)
        render json: { message: "#{user_item.item.name} unequipped.", user_item: serialize_user_item(user_item.reload) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Item not found" }, status: :not_found
      end

      def use
        user_item = current_user.user_items.find(params[:id])
        service = Items::UseService.new(current_user, user_item)

        if service.call
          render json: {
            message: service.result[:message],
            effect: service.result[:effect],
            settlements: service.result[:settlements]&.map { |s| serialize_settlement(s) },
            gold: current_user.reload.gold,
            mana: current_user.mana
          }
        else
          render json: { error: service.result[:message] }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Item not found" }, status: :not_found
      end

      private

      def serialize_user_item(ui)
        {
          id: ui.id,
          quantity: ui.quantity,
          equipped: ui.equipped,
          item: {
            id: ui.item.id,
            slug: ui.item.slug,
            name: ui.item.name,
            description: ui.item.description,
            item_type: ui.item.item_type,
            rarity: ui.item.rarity,
            rarity_color: ui.item.rarity_color,
            abilities: ui.item.abilities,
            use_effect: ui.item.use_effect
          }
        }
      end

      def serialize_settlement(settlement)
        {
          id: settlement.id,
          slug: settlement.slug,
          name: settlement.name,
          element: settlement.element,
          level: settlement.level,
          on_cooldown: settlement.on_cooldown?
        }
      end
    end
  end
end
