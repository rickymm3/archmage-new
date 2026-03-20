module TreasuryHelper
  def morale_color_class(morale)
    case morale
    when 90..100 then "text-success"
    when 50..89 then "text-warning"
    else "text-danger"
    end
  end

  def morale_text_class(morale)
    case morale
    when 90..100 then "text-success"
    when 50..89 then "text-warning"
    else "text-danger"
    end
  end

  def morale_status_text(morale)
    case morale
    when 90..100 then "High Spirits (Bonus Attack)"
    when 50..89 then "Stable"
    when 20..49 then "Low Morale (Reduced Attack)"
    else "Mutinous (Risk of Desertion)"
    end
  end

  def relative_time(time)
    return "" unless time
    tag.span(data: { controller: "timer", timer_target_value: time.iso8601 }) do
      time_ago_in_words(time)
    end
  end
end
