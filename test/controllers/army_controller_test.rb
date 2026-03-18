require "test_helper"

class ArmyControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get army_index_url
    assert_response :success
  end
end
