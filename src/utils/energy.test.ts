import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEnergyEstimate,
  isOutsideWorkingHours,
  sortTasksForSmartSchedule,
} from './energy';
import type { TaskItem } from '../types/lifeos';

test('energy estimate returns unavailable instead of fabricating metrics when logs are empty', () => {
  const result = calculateEnergyEstimate({
    healthLogs: [],
    appUsageLogs: [],
    energyLogs: [],
    dailyStepTarget: 8000,
    targetSleepHours: 6,
    peakConcentration: 'morning',
  });

  assert.equal(result.estimatedScore, null);
  assert.equal(result.level, 'unavailable');
  assert.equal(result.measuredFactors.sleepHours, null);
  assert.equal(result.measuredFactors.steps, null);
  assert.equal(result.baselineDaysLogged, 0);
});

test('energy estimate calculates transparent weighted score from available metrics only', () => {
  const result = calculateEnergyEstimate({
    healthLogs: [
      { id: 'h1', userId: 'u1', date: '2026-11-22', sleepHours: 5.5, steps: 6400, source: 'manual' },
      { id: 'h2', userId: 'u1', date: '2026-11-21', sleepHours: 5.5, steps: 7000, source: 'manual' },
    ],
    appUsageLogs: [
      {
        id: 'a1',
        userId: 'u1',
        date: '2026-11-22',
        productivityMinutes: 120,
        communicationMinutes: 45,
        socialMediaMinutes: 60,
        entertainmentMinutes: 30,
        educationMinutes: 25,
        otherMinutes: 15,
        nighttimeMinutes: 50,
        interruptions: 18,
        source: 'manual',
      },
    ],
    energyLogs: [
      { id: 'e1', userId: 'u1', date: '2026-11-22', energyLevel: 7, moodLevel: 7, focusLevel: 8, stressLevel: 4 },
    ],
    dailyStepTarget: 8000,
    targetSleepHours: 6,
    peakConcentration: 'morning',
  });

  assert.ok(result.estimatedScore !== null && result.estimatedScore >= 50 && result.estimatedScore <= 90);
  assert.equal(result.measuredFactors.sleepConsistencyPercent, 100);
  assert.equal(result.measuredFactors.restingHeartRate, null);
  assert.equal(result.baselineDaysLogged, 2);
});

test('working hours check flags tasks outside 09:00-17:00 schedule', () => {
  assert.equal(isOutsideWorkingHours('08:30', 9, 17), true);
  assert.equal(isOutsideWorkingHours('10:00', 9, 17), false);
  assert.equal(isOutsideWorkingHours('17:30', 9, 17), true);
  assert.equal(isOutsideWorkingHours(undefined, 9, 17), false);
});

test('smart schedule prioritizes deep work for morning concentration peak', () => {
  const tasks: TaskItem[] = [
    {
      id: 't1',
      userId: 'u1',
      title: 'Admin Emails',
      priority: 'high',
      category: 'admin',
      status: 'todo',
      deadline: '2026-11-22',
      estimatedMinutes: 30,
      actualMinutes: 0,
    },
    {
      id: 't2',
      userId: 'u1',
      title: 'Architecture Spec',
      priority: 'high',
      category: 'deep_work',
      status: 'todo',
      deadline: '2026-11-22',
      estimatedMinutes: 90,
      actualMinutes: 0,
    },
    {
      id: 't3',
      userId: 'u1',
      title: 'Done Task',
      priority: 'critical',
      category: 'deep_work',
      status: 'completed',
      deadline: '2026-11-22',
      estimatedMinutes: 45,
      actualMinutes: 45,
    },
  ];

  const sorted = sortTasksForSmartSchedule(tasks, 'morning');
  assert.equal(sorted[0].id, 't2');
  assert.equal(sorted[1].id, 't1');
  assert.equal(sorted[2].id, 't3');
});
