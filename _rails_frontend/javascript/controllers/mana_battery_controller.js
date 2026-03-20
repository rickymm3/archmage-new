import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    updated: String,
    duration: { type: Number, default: 14400 }, // 4 hours
    netPotential: Number // e.g., +500 or -200
  }

  static targets = ["liquid", "percent", "yield", "status"]

  connect() {
    this.startTimer()
  }

  disconnect() {
    this.stopTimer()
  }

  startTimer() {
    this.update()
    this.timer = setInterval(() => {
      this.update()
    }, 1000)
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  update() {
    const lastRecharge = new Date(this.updatedValue)
    const now = new Date()
    const elapsedSeconds = (now - lastRecharge) / 1000
    
    // Calculate Time Factor (0.0 to 1.0 of the cycle elapsed)
    let timeFactor = elapsedSeconds / this.durationValue
    timeFactor = Math.max(0, Math.min(1, timeFactor)) // Clamp 0 to 1
    
    // Battery Charge is inverse of Time Factor (Starts 100%, drains to 0%)
    const chargePercent = 1.0 - timeFactor
    
    // Calculate Projected Yield
    // Net Potential * Time Factor
    const currentYield = Math.floor(this.netPotentialValue * timeFactor)
    
    // Update Liquid Visual (Charge Level)
    if (this.hasLiquidTarget) {
        const visualHeight = Math.round(chargePercent * 100)
        this.liquidTarget.style.height = `${visualHeight}%`
        
        // Color logic based on charge level (Safety)
        this.liquidTarget.classList.remove("bg-info", "bg-warning", "bg-danger", "bg-success")
        
        if (chargePercent < 0.2) {
            // Very empty (High yield accumulated)
            this.liquidTarget.classList.add("bg-danger")
        } else if (chargePercent < 0.5) {
            this.liquidTarget.classList.add("bg-warning")
        } else {
            this.liquidTarget.classList.add("bg-info")
        }
    }
    
    // Update Percentage Text
    if (this.hasPercentTarget) {
         const visualPercent = Math.round(chargePercent * 100)
        this.percentTarget.textContent = `${visualPercent}%`
    }
    
    // Update Yield Display
    if (this.hasYieldTarget) {
        const isNegative = currentYield < 0
        const sign = currentYield >= 0 ? "+" : ""
        this.yieldTarget.textContent = `${sign}${currentYield}`
        
        this.yieldTarget.classList.remove("text-info", "text-danger", "text-success")
        if (isNegative) {
            this.yieldTarget.classList.add("text-danger")
        } else {
            this.yieldTarget.classList.add("text-success")
        }
    }
    
    // Status Message
    if (this.hasStatusTarget) {
         if (this.netPotentialValue < 0) {
             this.statusTarget.textContent = "DRAINING"
             this.statusTarget.classList.add("text-danger", "blink")
         } else {
             this.statusTarget.textContent = "Charging"
             this.statusTarget.classList.remove("text-danger", "blink")
         }
    }
  }
}
