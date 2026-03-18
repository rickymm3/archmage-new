import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "unitSelect", "quantityInput", "durationOutput", "landOutput", "dangerOutput", "maxButton" ]
  static values = { userLand: Number }

  connect() {
    this.update()
  }

  update() {
    const unitSelect = this.unitSelectTarget
    const qtyInput = this.quantityInputTarget
    const maxBtn = this.hasMaxButtonTarget ? this.maxButtonTarget : null
    
    // Check if we have options selected
    if (!unitSelect.selectedOptions || unitSelect.selectedOptions.length === 0) return

    const item = unitSelect.selectedOptions[0]
    const speed = parseFloat(item.dataset.speed) || 5
    const available = parseInt(item.dataset.available) || 0
    const unitId = unitSelect.value

    if (unitId === "") {
        // If no unit selected, quantity is locked to 0
        qtyInput.value = 0
        qtyInput.disabled = true
        if (maxBtn) maxBtn.disabled = true
    } else {
        qtyInput.max = available
        qtyInput.disabled = false
        if (maxBtn) maxBtn.disabled = false
        
        // Cap value
        if (parseInt(qtyInput.value) > available) qtyInput.value = available
    }

    const qty = parseInt(qtyInput.value) || 0

    // Duration Calculation (Mirrors Ruby Service)
    // Exponential Scaling: 10 * e^(0.08 * Land)
    // 10 Land -> ~22s | 100 Land -> ~8.3h
    const baseSeconds = Math.ceil(10 * Math.exp(0.08 * this.userLandValue))

    let reductionPercent = 0
    if (unitId !== "") {
        // Speed 20 = 10%, Speed 50 = 25% (Max 50)
        reductionPercent = Math.min(speed * 0.5, 50)
    }
    
    const seconds = Math.ceil(baseSeconds * (1.0 - (reductionPercent / 100.0)))
    this.durationOutputTarget.textContent = this.formatDuration(seconds)
    
    // Land Potential: Base 1 + (Log(qty) * Speed/20)
    let potential = 1
    if (qty > 0 && unitId !== "") {
        const logQty = Math.log(qty + 1)
        const speedFactor = speed / 20.0
        potential = Math.ceil(1 + (logQty * speedFactor))
    }
    this.landOutputTarget.textContent = "~" + potential

    // Danger Assessment
    this.updateDanger(unitId, qty)
  }

  setMax(event) {
    if (event) event.preventDefault()
    
    const option = this.unitSelectTarget.selectedOptions[0]
    if (!option) return
    
    const available = parseInt(option.dataset.available) || 0
    this.quantityInputTarget.value = available
    this.update()
  }
  
  formatDuration(seconds) {
      if (seconds < 60) return seconds + "s"
      if (seconds < 3600) return Math.ceil(seconds / 60) + "m"
      const h = Math.floor(seconds / 3600)
      const m = Math.ceil((seconds % 3600) / 60)
      return `${h}h ${m}m`
  }
  
  updateDanger(unitId, qty) {
      const el = this.dangerOutputTarget
      el.className = "" // Clear classes
      
      const land = this.userLandValue
      
      // Safety calculation (Mirrors service)
      // < 20 Land = 0% Base
      // > 20 Land = (Land - 20)/2 (Max 40)
      let baseChance = Math.max((land - 20) / 2, 0)
      baseChance = Math.min(baseChance, 40)
      
      // Escort Bonus (50% reduction)
      const modifier = (unitId !== "" && qty > 0) ? 0.5 : 1.0
      const finalChance = Math.ceil(baseChance * modifier)
      
      let text = ""
      let classes = "fs-4 fw-bold " // Base classes
      
      if (finalChance <= 0) {
          text = "Safe (0% Risk)"
          classes += "text-success"
      } else {
          text = `${finalChance}% Encounter Chance`
          
          if (finalChance < 10) {
             classes += "text-info"
          } else if (finalChance < 20) {
             classes += "text-warning"
          } else {
             classes += "text-danger"
             if (modifier === 1.0) text += " (Unescorted!)"
          }
      }
      
      el.textContent = text
      el.className = classes
  }
}
