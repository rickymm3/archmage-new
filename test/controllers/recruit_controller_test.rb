require "test_helper"

class RecruitControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get recruit_index_url
    assert_response :success
  end
end
