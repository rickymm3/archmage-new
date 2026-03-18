import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    current: Number,
    updatedAt: String,
    decayRate: Number // decay per second
  }

  static targets = ["bar", "text", "status"]

  connect() {
    this.startAnimation()
  }

  disconnect() {
    this.stopAnimation()
  }

  startAnimation() {
    this.animationInterval = setInterval(() => {
      this.update()
    }, 1000) // Update every second
    this.update() // Initial update
  }

  stopAnimation() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval)
    }
  }

  update() {
    const now = new Date().getTime()
    const updatedAt = new Date(this.updatedAtValue).getTime()
    const elapsedSeconds = (now - updatedAt) / 1000
    
    // logic: current - (elapsed * rate)
    // decayRateValue is passed from Rails as (100.0 / 86400.0)
    let liveMorale = this.currentValue - (elapsedSeconds * this.decayRateValue)
    liveMorale = Math.max(0, Math.min(100, liveMorale))
    
    // Update Progress Bar
    if (this.hasBarTarget) {
      const percentage = liveMorale.toFixed(1)
      this.barTarget.style.width = `${percentage}%`
      this.barTarget.setAttribute("aria-valuenow", percentage)
      
      this.updateBarColor(liveMorale)
    }

    // Update Text Display
    if (this.hasTextTarget) {
       // Display integer but keep decimal internally for bar
       this.textTarget.innerHTML = `${Math.floor(liveMorale)}<small class="fs-6 text-white-50">/100</small>`
    }

    // Update Status Text
    if (this.hasStatusTarget) {
      const { text, className } = this.getStatus(liveMorale)
      this.statusTarget.innerHTML = text
      this.statusTarget.className = `small ${className}`
    }
  }

  updateBarColor(value) {
    this.barTarget.classList.remove('bg-success', 'bg-info', 'bg-warning', 'bg-danger')
    
    // Matches Rails helper logic roughly
    if (value > 80) {
      this.barTarget.classList.add('bg-success')
    } else if (value > 50) {
      this.barTarget.classList.add('bg-info')
    } else if (value > 25) {
      this.barTarget.classList.add('bg-warning')
    } else {
      this.barTarget.classList.add('bg-danger')
    }
  }

  getStatus(value) {
    if (value > 80) return { text: "High Morale", className: "text-success" }
    if (value > 50) return { text: "Stable", className: "text-info" }
    if (value > 25) return { text: "Unrest Growing", className: "text-warning" }
    return { text: "Mutiny Imminent", className: "text-danger fw-bold" }
  }
}
