module Api
  module V1
    class RankingsController < BaseController
      def index
        rankings = User.all.includes(user_structures: :structure, user_units: :unit, active_spells: :spell)
                       .map do |user|
                         {
                           id: user.id,
                           username: user.username,
                           kingdom_name: user.display_kingdom_name,
                           affinity: user.affinity.name,
                           color: user.color,
                           power: user.net_power,
                           land: user.land,
                           army_size: user.user_units.sum(&:quantity) + user.user_units.sum(&:garrison),
                           has_fog: user.active_spells.any? { |as| as.spell.name == "Fog" }
                         }
                       end
                       .sort_by { |r| -r[:power] }
                       .each_with_index.map { |r, i| r.merge(rank: i + 1) }
                       .first(100)

        render json: { rankings: rankings }
      end
    end
  end
end
