require "test_helper"

class ActiveSpellsControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get active_spells_index_url
    assert_response :success
  end

  test "should get destroy" do
    get active_spells_destroy_url
    assert_response :success
  end
end
