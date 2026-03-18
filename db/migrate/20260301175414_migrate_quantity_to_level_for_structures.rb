class MigrateQuantityToLevelForStructures < ActiveRecord::Migration[8.0]
  def up
    # Find all structures that are level based
    structs = Structure.where(level_based: true)
    
    # Iterate for safety
    structs.each do |s|
       # Update user structures: if quant > 1, make level = quant, and quant = 1
       # This assumes 'quantity' was the proxy for progress before we introduced levels
       UserStructure.where(structure_id: s.id).where('quantity > 1').each do |us|
         us.update!(level: us.quantity, quantity: 1)
       end
    end
  end

  def down
    # Reverse logic: if level > 1, make quantity = level, level = 1
    structs = Structure.where(level_based: true)
    structs.each do |s|
      UserStructure.where(structure_id: s.id).where('level > 1').each do |us|
        us.update!(quantity: us.level, level: 1)
      end
    end
  end
end
