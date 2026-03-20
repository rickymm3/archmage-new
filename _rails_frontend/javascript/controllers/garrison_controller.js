import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "input", "fieldCount", "garrisonCount", "sidebarItem", "row", "checkIcon" ] 

  connect() {
    this.initialRender()
  }

  // Called once on connect to set up initial state
  initialRender() {
    this.refreshUI()
    this.checkEmptyState()
  }

  // Triggered by sidebar click
  activate(event) {
    const button = event.currentTarget
    const unitId = button.dataset.unitId
    const row = this.element.querySelector(`[data-garrison-target="row"][data-unit-id="${unitId}"]`)
    
    if (row && row.classList.contains('d-none')) {
        row.classList.remove('d-none')
        
        // Highlight sidebar item
        button.classList.add('active-garrison-item')
        
        const icon = button.querySelector('.bi-check-circle-fill')
        if (icon) icon.classList.remove('d-none')

        this.checkEmptyState()
    }
  }

  // Triggered by X button in row
  remove(event) {
    const button = event.currentTarget
    const unitId = button.dataset.unitId
    
    // Find the row
    const row = this.element.querySelector(`[data-garrison-target="row"][data-unit-id="${unitId}"]`)
    
    if (row) {
        // Reset slider to 0
        const input = row.querySelector('input[type="range"]')
        if (input) {
            input.value = 0
            // Update UI for this specific input (colors, text)
            this.updateUI(input)
        }

        row.classList.add('d-none')
        
        // Un-highlight sidebar item
        const sidebarItem = this.element.querySelector(`[data-garrison-target="sidebarItem"][data-unit-id="${unitId}"]`)
        if (sidebarItem) {
            sidebarItem.classList.remove('active-garrison-item')
            const icon = sidebarItem.querySelector('.bi-check-circle-fill')
            if (icon) icon.classList.add('d-none')
        }

        this.checkEmptyState()
        this.updateTotalDefense()
    }
  }

  // Triggered by slider input
  update(event) {
    this.updateUI(event.target)
    this.updateTotalDefense()
  }
  
  refreshUI() {
    this.inputTargets.forEach(input => {
      this.updateUI(input)
    })
    this.updateTotalDefense()
  }

  updateUI(input) {
    const value = parseInt(input.value) || 0
    const total = parseInt(input.dataset.total) || 0
    
    // Find the associated elements within the row container
    // Structure: card-body -> div -> input
    const container = input.closest('.card-body')
    if (!container) return

    const fieldEl = container.querySelector('[data-garrison-target="fieldCount"]')
    const garrisonEl = container.querySelector('[data-garrison-target="garrisonCount"]')

    if (fieldEl) fieldEl.innerText = (total - value).toLocaleString()
    if (garrisonEl) garrisonEl.innerText = value.toLocaleString()

    // Update gradient
    const percent = (total > 0) ? (value / total) * 100 : 0
    input.style.background = `linear-gradient(to right, #0dcaf0 0%, #0dcaf0 ${percent}%, #343a40 ${percent}%, #343a40 100%)`
  }

  updateTotalDefense() {
    let checkTotal = 0
    
    // We select all rows, regardless of visibility, because a hidden row just had 
    // its value set to 0 in this.remove(), so the math is safe.
    // However, iterating over targets[row] is safer.
    
    this.rowTargets.forEach(row => {
        const def = parseInt(row.dataset.unitDefense || 0)
        const input = row.querySelector('input')
        if (input) {
            const qty = parseInt(input.value || 0)
            checkTotal += (qty * def)
        }
    })

    const totalEl = document.getElementById('total_defense_power')
    if (totalEl) totalEl.textContent = checkTotal.toLocaleString()

    const mobileTotal = document.getElementById('total_defense_power_mobile')
    if (mobileTotal) mobileTotal.textContent = checkTotal.toLocaleString()
  }
  
  checkEmptyState() {
     // Check if ANY row does NOT have class d-none
     const anyVisible = this.rowTargets.some(r => !r.classList.contains('d-none'))
     const emptyState = document.getElementById('empty-state')
     if (emptyState) {
         if (anyVisible) {
             emptyState.classList.add('d-none')
         } else {
             emptyState.classList.remove('d-none')
         }
     }
  }
}
