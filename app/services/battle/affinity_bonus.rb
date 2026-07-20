module Battle
  # Affinity synergy: units whose element matches their commander's chosen
  # affinity (pyromancer→fire, mindweaver→water, geomancer→nature,
  # tempest→holy, voidwalker→void) fight harder for them. Deliberately
  # modest — encourages fielding your own color without making off-color
  # armies feel useless.
  class AffinityBonus
    BONUS = 1.10 # +10% attack & defense

    def self.apply!(user, stacks)
      element = user.respond_to?(:affinity_element) ? user.affinity_element : nil
      return stacks unless element && stacks

      stacks.each do |s|
        next unless s[:element].to_s.downcase == element
        s[:attack] = (s[:attack].to_f * BONUS).round(2)
        s[:defense] = (s[:defense].to_f * BONUS).round(2)
      end
      stacks
    end
  end
end
