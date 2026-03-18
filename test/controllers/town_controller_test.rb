require "test_helper"

class TownControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get town_index_url
    assert_response :success
  end
end
