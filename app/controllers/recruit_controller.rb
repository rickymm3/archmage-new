class RecruitController < ApplicationController
  def index
    barracks = current_user.structures.find_by(slug: 'barracks')
    @barracks_structure = barracks

    if barracks
      user_barracks = current_user.user_structures.find_by(structure: barracks)
      @current_level = user_barracks&.level || 0
    else
      @current_level = 0
    end

    @units = Unit.where(recruitable: true)
    @user_units = current_user.user_units.index_by(&:unit_id)
    @active_orders = current_user.active_recruitment_orders.includes(:unit).order(created_at: :desc)
    @completed_orders = current_user.recruitment_orders.finished.order(completed_at: :desc).limit(5).includes(:unit)
    @max_slots = current_user.recruitment_slots
    @used_slots = @active_orders.size
  end

  def create
    service = ::Town::CreateRecruitmentOrderService.new(current_user, params[:unit_id], params[:tier])

    if service.call
      redirect_to recruit_index_path, notice: service.result[:message]
    else
      redirect_to recruit_index_path, alert: service.errors.join(". ")
    end
  end

  def accept
    service = ::Town::AcceptRecruitsService.new(current_user, params[:id])

    if service.call
      r = service.result
      redirect_to recruit_index_path, notice: "#{r[:accepted]} #{r[:unit_name].pluralize(r[:accepted])} joined your army!"
    else
      redirect_to recruit_index_path, alert: service.errors.join(". ")
    end
  end

  def cancel
    service = ::Town::CancelRecruitmentOrderService.new(current_user, params[:id])

    if service.call
      r = service.result
      msg = "Order cancelled."
      msg += " #{r[:auto_accepted]} #{r[:unit_name].pluralize(r[:auto_accepted])} accepted." if r[:auto_accepted] > 0
      msg += " #{r[:refund]} gold refunded." if r[:refund] > 0
      redirect_to recruit_index_path, notice: msg
    else
      redirect_to recruit_index_path, alert: service.errors.join(". ")
    end
  end
end
