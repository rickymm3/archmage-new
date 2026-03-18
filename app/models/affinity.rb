class Affinity
  attr_reader :id, :name, :description, :css_class

  def initialize(id:, name:, description:, css_class:)
    @id = id.to_s
    @name = name
    @description = description
    @css_class = css_class
  end

  # Define the core game affinities.
  # The IDs here are stored in the database.
  # If you change the NAME, only the UI changes.
  # If you change the ID, you must migrate old data.
  def self.all
    [
      new(
        id: :pyromancer, 
        name: "Pyromancer", 
        description: "Wielders of destructive fire magic. Specialized in direct damage and offense.", 
        css_class: "text-danger" # Bootstrap red
      ),
      new(
        id: :mindweaver, 
        name: "Mindweaver", 
        description: "Masters of illusion and control. Specialized in trickery and intelligence.", 
        css_class: "text-info" # Bootstrap blue/cyan
      ),
      new(
        id: :geomancer, 
        name: "Geomancer", 
        description: "Shapers of earth and nature. Specialized in growth and summoning beasts.", 
        css_class: "text-success" # Bootstrap green
      ),
      new(
        id: :tempest, 
        name: "Tempest", 
        description: "Commanders of storms and lightning. Specialized in speed and area effects.", 
        css_class: "text-warning" # Bootstrap yellow
      ),
      new(
        id: :voidwalker, 
        name: "Voidwalker", 
        description: "Callers of the abyss. Specialized in draining life and weakening foes.", 
        css_class: "text-secondary" # Bootstrap grey/dark
      )
    ]
  end

  def self.find(id)
    all.find { |a| a.id == id.to_s }
  end

  def self.valid_ids
    all.map(&:id)
  end
end
