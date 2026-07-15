module Battle
  module EquipmentBonus
    # Mutates and returns stack hashes in-place, applying each of the user's
    # equipped items' abilities using the same buff_type/buff_element/
    # buff_attack_pct/buff_defense_pct/buff_speed keys that
    # Battle::CalculatorService::Stack#apply_generic_hero_passive uses for
    # hero passives, applied before the stacks reach Battle::CalculatorService
    # (same idiom as Battle::ResolutionService#apply_active_spell_bonuses).
    def self.apply!(user, stacks)
      equipped_items = user.user_items.equipped.includes(:item).map(&:item)
      return stacks if equipped_items.empty?

      equipped_items.each do |item|
        abilities = item.abilities || {}
        next if abilities.blank?

        type_filter = abilities['buff_type']
        element_filter = abilities['buff_element']

        stacks.each do |stack|
          next if type_filter && stack[:type].to_s.downcase != type_filter.to_s.downcase
          next if element_filter && stack[:element].to_s.downcase != element_filter.to_s.downcase

          if (pct = abilities['buff_attack_pct'].to_f) > 0
            stack[:attack] = (stack[:attack] * (1.0 + pct)).ceil
          end
          if (pct = abilities['buff_defense_pct'].to_f) > 0
            stack[:defense] = (stack[:defense] * (1.0 + pct)).ceil
          end
          if (bonus = abilities['buff_speed'].to_i) > 0
            stack[:speed] = stack[:speed].to_i + bonus
          end
        end
      end

      stacks
    end
  end
end
