puts "Updating structures with production..."
# Update Town Center to produce Gold
Structure.find_by(slug: "town_center")&.update!(production: { gold: 100 })

puts "Done!"
