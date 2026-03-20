class HomeController < ApplicationController
  allow_unauthenticated_access

  def index
    redirect_to "/mobile", allow_other_host: false
  end
end
