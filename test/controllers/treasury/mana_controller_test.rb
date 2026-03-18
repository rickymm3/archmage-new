require "test_helper"

class Treasury::ManaControllerTest < ActionDispatch::IntegrationTest
  test "should get recharge" do
    get treasury_mana_recharge_url
    assert_response :success
  end

  test "should get status" do
    get treasury_mana_status_url
    assert_response :success
  end
end
