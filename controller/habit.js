const Habit = require("../models/Habit");
const User = require("../models/User");
const moment = require("moment");
const asyncHandler = require("express-async-handler");

// Fetch the GUEST user and render the habit lists
const home = asyncHandler(async (req, res) => {
  const user = await User.findOne({ userName: "Guest" }).populate("habits");
  return res.render("home", { habitList: user.habits });
});

// Create a new habit and update the completions map for the habit
const add = asyncHandler(async (req, res) => {
  // Create the habit
  const habit = await Habit.create({
    habit_name: req.body.habit_name,
    start: req.body.start,
    end: req.body.end,
  });

  // Get all the days from the start and end dates
  var start = moment(habit.start, "DD/MM/YYYY");
  var end = moment(habit.end, "DD/MM/YYYY");
  var today = moment(new Date(), "DD/MM/YYYY");

  // Calculate the total number of days from today to the start date
  let totalDaysTillDate = today.diff(start, "days") + 2;

  // Calculate the total number of days between the start and end dates
  let totalDays = end.diff(start, "days");

  // Fill the completions map with "None" values
  let completionsMap = new Map();
  for (let d = 0; d <= totalDays; d++) {
    var new_date = moment(habit.start, "DD/MM/YYYY");
    let date = new_date.add(d, "days").format("DD/MM/YYYY");
    completionsMap.set(date, "None");
  }

  // Update the completions map in the Habit database
  await Habit.updateOne(
    { _id: habit._id },
    {
      $set: {
        completions: completionsMap,
        totalDaysTillDate: totalDaysTillDate,
      },
    }
  );

  // Find the GUEST user and add the updated habit to their habit list
  const user = await User.findOne({ userName: "Guest" });
  user.habits.push(habit);
  user.save();

  return res.redirect("back");
});

// Display the details of a single habit, including its last 7 days of actions and its current streak
const showHabit = asyncHandler(async (req, res) => {
  // Find the habit by its ID
  const habit = await Habit.findById(req.params.id);

  // Get the start date of the habit
  let tempStr = habit.start.toString().split(" ").slice(0, 4);
  let startDate =
    tempStr[0] + " " + tempStr[1] + " " + tempStr[2] + " " + tempStr[3];

  // Loop through the last 7 days from today
  let arr = [];
  for (let d = 6; d >= 0; d--) {
    const previous = new Date();
    previous.setDate(previous.getDate() - d);
    let dateStr = previous.toString().split(" ");

    // Create a temporary date string
    let tempDate =
      dateStr[0] + " " + dateStr[1] + " " + dateStr[2] + " " + dateStr[3];

    // Compare the habit start date with the previous date
    if (habit.start < previous || startDate == tempDate) {
      // Fetch the date and actions from the completions map
      let action = habit.completions.get(
        moment(tempDate).format("DD/MM/YYYY").toString()
      );

      // Push the date and actions into the array
      arr.push({ date: tempDate, action: action });
    }
  }

  // Render the habit and its last 7 days of status
  return res.render("habit", {
    habit: habit,
    lastDays: arr,
    starting: startDate,
  });
});

// Toggle the status of a habit completion for a specific day and update the habit's completions map and streak metrics
const takeAction = asyncHandler(async (req, res) => {
  // Find the habit by its ID
  const habit = await Habit.findById(req.params.id);

  // Get the date to toggle the status for
  const date = moment().subtract(req.body.dayBefore, "days").format("DD/MM/YYYY");

  // Temporary store the habit completions map
  const completionsMap = habit.completions;

  // Toggle the status here
  switch (completionsMap.get(date)) {
    case "Done":
      completionsMap.set(date, "Not-Done");
      break;
    case "Not-Done":
      completionsMap.set(date, "None");
      break;
    case "None":
      completionsMap.set(date, "Done");
      break;
  }

  // Calculate the habit's streak metrics
  let totalDays = 0;
  let currentScore = 0;
  let bestScore = 0;
  let success = 0;

  for (const [date, status] of completionsMap) {
    totalDays++;

    if (date === moment().format("DD/MM/YYYY")) {
      if (status === "Done") {
        currentScore++;
        success++;
        if (currentScore > bestScore) {
          bestScore = currentScore;
        }
      } else {
        currentScore = 0;
      }
      break;
    } else {
      if (status === "Done") {
        currentScore++;
        success++;
        if (currentScore > bestScore) {
          bestScore = currentScore;
        }
      } else {
        currentScore = 0;
      }
    }
  }

  // Update the habit in the database
  await Habit.updateOne(
    { _id: req.params.id },
    {
      $set: {
        current_Streak: currentScore,
        best_Streak: bestScore,
        success_Days: success,
        totalDaysTillDate: totalDays,
        completions: completionsMap,
      },
    }
  );

  return res.redirect("back");
});

// Habit delete action
const habitDelete = asyncHandler(async (req, res) => {
  // Find the habit and remove it
  let habit = await Habit.findById(req.params.id);
  habit.remove();

  // Find the user and remove the habit ID from the user's habit list
  const user = await User.findOne({ userName: "Guest" });
  let post = await User.findByIdAndUpdate(user._id, {
    $pull: { habits: req.params.id },
  });

  return res.redirect("back");
});

module.exports = { home, add, showHabit, takeAction, habitDelete };