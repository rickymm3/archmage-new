Rails.application.routes.draw do
  resources :rankings, only: [:index]
  resources :active_spells, only: [:index, :destroy]

  namespace :treasury do
    post "mana/recharge"
    get "mana/status"
  end
  get "heroes/index"
  get "marketplace/index"
  get "army/index"
  get "recruit/index"
  post "recruit/create"
  post "recruit/:id/accept", to: "recruit#accept", as: :accept_recruit_order
  post "recruit/:id/cancel", to: "recruit#cancel", as: :cancel_recruit_order

  resources :spells, only: [:index] do
     get :casting, on: :collection
     post :research, on: :collection
     post :cast, on: :collection
  end

  resources :user_structures
  resources :structures
  resource :session
  resource :registration, only: %i[new create]
  resources :passwords, param: :token
  
  resources :notifications, only: [:index, :show] do
    post :mark_all_read, on: :collection
  end

  # Game Resources
  resource :town, only: [:show], controller: :town do
    post :build
    post :upgrade
    post :demolish
    post :downgrade
    post :recruit
  end

  # Exploration routes
  resources :explorations, only: [:index, :create] do
     post :claim, on: :member
  end

  # Battle routes
  resources :battles, only: [:index, :new, :create] do
    post :scout, on: :collection
  end

  resources :treasury, only: [:index] do
    collection do
      post :tax
    end
  end

  resources :spells, only: [:index]
  resources :recruit, only: [:index]
  
  resource :army, only: [:show], controller: :army do
    post :pay_upkeep
    post :disband
    get :garrison
    patch :update_garrison
    patch :assign_hero
  end

  resources :marketplace, only: [:index] do
    post :bid, on: :member
    post :collect, on: :member
  end
  
  resources :heroes, only: [:index]
  
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # ─── API ────────────────────────────────────────────────────────────
  namespace :api do
    namespace :v1 do
      # Auth
      post   "auth/login",    to: "auth#login"
      post   "auth/register", to: "auth#register"
      delete "auth/logout",   to: "auth#logout"
      get    "auth/me",       to: "auth#me"
      patch  "auth/kingdom_name", to: "auth#update_kingdom_name"

      # Dashboard (consolidated home screen)
      get "dashboard", to: "dashboard#show"

      # Town / Structures
      get  "town",          to: "town#show"
      post "town/build",    to: "town#build"
      post "town/demolish", to: "town#demolish"
      post "town/recruit",  to: "town#recruit"

      # Army
      get   "army",              to: "army#show"
      post  "army/pay_upkeep",   to: "army#pay_upkeep"
      post  "army/disband",      to: "army#disband"
      get   "army/garrison",     to: "army#garrison"
      patch "army/garrison",     to: "army#update_garrison"
      patch "army/assign_hero",  to: "army#assign_hero"

      # Spells
      get  "spells",              to: "spells#index"
      get  "spells/casting",      to: "spells#casting"
      post "spells/:id/research", to: "spells#research"
      post "spells/:id/cast",     to: "spells#cast"

      # Battles
      get  "battles",            to: "battles#index"
      post "battles/scout",      to: "battles#scout"
      get  "battles/:id/setup",  to: "battles#setup"
      post "battles",            to: "battles#create"

      # Explorations
      get  "explorations",           to: "explorations#index"
      post "explorations",           to: "explorations#create"
      post "explorations/:id/claim", to: "explorations#claim"

      # Marketplace
      get  "marketplace",             to: "marketplace#index"
      post "marketplace/:id/bid",     to: "marketplace#bid"
      post "marketplace/:id/collect", to: "marketplace#collect"

      # Treasury
      get  "treasury",              to: "treasury#index"
      post "treasury/tax",          to: "treasury#tax"
      post "treasury/mana/recharge", to: "treasury#mana_recharge"
      get  "treasury/mana/status",   to: "treasury#mana_status"

      # Notifications
      get  "notifications",               to: "notifications#index"
      get  "notifications/:id",            to: "notifications#show"
      post "notifications/mark_all_read",  to: "notifications#mark_all_read"

      # Rankings
      get "rankings", to: "rankings#index"

      # Active Spells
      get    "active_spells",     to: "active_spells#index"
      delete "active_spells/:id", to: "active_spells#destroy"

      # Recruit
      get  "recruit", to: "recruit#index"
      post "recruit", to: "recruit#create"
      post "recruit/:id/accept", to: "recruit#accept"
      post "recruit/:id/cancel", to: "recruit#cancel"
    end
  end

  # Defines the root path route ("/")
  root "home#index"

  # Serve Expo web SPA — catch-all for client-side routing.
  # Static assets (JS, CSS, images) in public/mobile/ are served automatically
  # by Rails middleware. This route handles SPA navigation paths that don't
  # map to real files, serving index.html so React Router can handle them.
  spa_index = proc { [200, { "content-type" => "text/html; charset=utf-8" }, [Rails.public_path.join("mobile/index.html").read]] }
  get "mobile", to: spa_index
  get "mobile/*path", to: spa_index, constraints: ->(req) { !req.path.match?(/\.\w+$/) }
end
