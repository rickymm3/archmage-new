class TownController < ApplicationController
  def show
    @structures = Structure.all.order(:id)
    # Ensure user has structures initialized
    current_user.grant_initial_structures if current_user.user_structures.empty?
    @user_structures = current_user.user_structures.index_by(&:structure_id)

    # Determine which structure to show details for
    if params[:structure_id]
      @selected_structure = @structures.find { |s| s.id == params[:structure_id].to_i }
    else
      @selected_structure = @structures.first
    end
    
    if @selected_structure&.slug == 'barracks'
      @units = Unit.where(recruitable: true).order(:id)
      @user_units = current_user.user_units.index_by(&:unit_id)
    end
  end

  def build
    structure = Structure.find(params[:structure_id])
    quantity = params[:quantity].to_i
    quantity = 1 if quantity <= 0

    service = ::Town::BuildService.new(current_user, structure, quantity)

    if service.call
       message = if structure.level_based?
         # Since service succeeded, and user_structure was updated, let's fetch it to show new level
         # Actually, we can just fetch the structure from user to be safe
         us = current_user.user_structures.find_by(structure: structure)
         "Successfully upgraded #{structure.name} to Level #{us.level}"
       else
         "Successfully built #{quantity} #{structure.name.pluralize(quantity)}"
       end
      redirect_to town_path(structure_id: structure.id), notice: message
    else
      redirect_to town_path(structure_id: structure.id), alert: service.errors.full_messages.to_sentence
    end
  end

  def demolish
    structure = Structure.find(params[:structure_id])
    quantity = params[:quantity].to_i
    quantity = 1 if quantity <= 0

    service = ::Town::DemolishService.new(current_user, structure, quantity)

    if service.call
       message = if structure.level_based?
         us = current_user.user_structures.find_by(structure: structure)
         "Successfully downgraded #{structure.name} to Level #{us.level}"
       else
         "Successfully demolished #{quantity} #{structure.name.pluralize(quantity)}"
       end

      redirect_to town_path(structure_id: structure.id), notice: message
    else
      redirect_to town_path(structure_id: structure.id), alert: service.errors.full_messages.to_sentence
    end
  end

  def recruit
    structure = Structure.find(params[:structure_id])
    unit = Unit.find(params[:unit_id])
    tier = params[:tier] || "standard"

    service = ::Town::CreateRecruitmentOrderService.new(current_user, unit.id, tier)

    if service.call
      redirect_to town_path(structure_id: structure.id), notice: service.result[:message]
    else
      redirect_to town_path(structure_id: structure.id), alert: service.errors.join(". ")
    end
  end
end

