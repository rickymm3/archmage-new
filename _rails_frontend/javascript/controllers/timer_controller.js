import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["output"]
  static values = { end: String, reload: Boolean }

  connect() {
    console.log("Timer connected", this.element)
    this.update()
    if (this.interval) clearInterval(this.interval)
    this.interval = setInterval(() => this.update(), 1000)
  }

  disconnect() {
    if (this.interval) clearInterval(this.interval)
  }

  update() {
    // Get value safely
    let rawValue = this.hasEndValue ? this.endValue : this.element.getAttribute("data-timer-end-value")
    
    if (!rawValue) {
      if (this.hasOutputTarget) this.outputTarget.textContent = "No Date"
      return
    }

    // Handle both ISO strings and numeric timestamps
    let targetDate
    if (typeof rawValue === 'number') {
      targetDate = rawValue
    } else if (rawValue.match(/^\d+$/)) {
      targetDate = parseInt(rawValue, 10)
    } else {
      targetDate = new Date(rawValue).getTime()
    }
    
    // Check validity
    if (isNaN(targetDate)) {
      console.error("Invalid timer value specified:", rawValue)
      if (this.hasOutputTarget) this.outputTarget.textContent = "Invalid"
      return
    }

    const now = new Date().getTime()
    const distance = targetDate - now

    if (distance < 0) {
      if (this.hasOutputTarget) this.outputTarget.textContent = "Ended"
      if (this.reloadValue) {
        setTimeout(() => location.reload(), 2000)
      }
      clearInterval(this.interval)
      return
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((distance % (1000 * 60)) / 1000)

    if (this.hasOutputTarget) {
      let timeString = ""
      if (hours > 0) {
        timeString = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      } else {
        timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      }
      this.outputTarget.textContent = timeString
    }
  }
}
