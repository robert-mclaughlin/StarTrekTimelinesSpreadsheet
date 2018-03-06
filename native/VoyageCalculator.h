#ifndef VOYAGE_CALCULATOR_H
#define VOYAGE_CALCULATOR_H
#include <array>
#include <vector>
#include <algorithm>
#include <functional>
#include <chrono>
#include <set>
#include <iostream>

#include "Log.h"
#include "ThreadPool.h"
#include "json.hpp"

namespace VoyageTools
{
extern Log log;

constexpr unsigned int SKILL_COUNT = 6;
constexpr unsigned int SLOT_COUNT = SKILL_COUNT*2;

struct Timer
{
	using clock = std::chrono::high_resolution_clock;
	using timepoint = decltype(clock::now());
	using duration = decltype(clock::now()-clock::now());

	Timer() = delete;
	Timer(std::string name = "", bool start = true) : running(start), name(name) {}
	~Timer() { if (running) Pause(); Print(); }

	void Pause()
	{
		total += clock::now()-start;
	}

	void Resume()
	{
		start = clock::now();
	}

	struct Scope
	{
		Timer &timer;
		Scope(Timer &timer) : timer(timer) { timer.Resume(); }
		~Scope() { timer.Pause(); }
	};

	void Print()
	{
		log << name << " took " << std::chrono::duration_cast<std::chrono::milliseconds>(total).count() << " ms" << std::endl;;
	}

	bool running;
	std::string name;
	duration total{0};
	timepoint start = clock::now();
};

struct Crew
{
	std::string name;
	unsigned int id{0};
	std::array<unsigned int, SKILL_COUNT> skills;
	std::array<unsigned int, SKILL_COUNT> skillMaxProfs;
	std::array<unsigned int, SKILL_COUNT> skillMinProfs;
	std::set<size_t> traits;
	// treated as a bool, but avoiding bit masking vector<bool> specialization for multithreading
	mutable std::vector<int> considered;
	const Crew *original{nullptr};
	std::array<const Crew*, SLOT_COUNT> slotCrew;
	unsigned int score{0};
};

class VoyageCalculator
{
public:
	VoyageCalculator(const char* jsonInput) noexcept;

	const std::string& GetSlotName(size_t index) const noexcept
	{
		return slotNames[index];
	}

	std::array<const Crew *, SLOT_COUNT> Calculate(
		std::function<void(const std::array<const Crew *, SLOT_COUNT>&, double)> progressCallback,
		double& score) noexcept
	{
		progressUpdate = progressCallback;
		calculate();
		score = bestscore;
		return bestconsidered;
	}

private:
	void calculate() noexcept;
	void findBest() noexcept;
	void fillSlot(size_t slot, unsigned int minScore, size_t minDepth, size_t seedSlot, size_t thread = -1) noexcept;
	void updateSlotRosterScores() noexcept;
	void resetRosters() noexcept;
	float calculateDuration(const std::array<const Crew *, SLOT_COUNT> &complement, bool debug = false) noexcept;
	
	// old disused functions
	void refine() noexcept;
	unsigned int computeScore(const Crew& crew, size_t skill, size_t trait) const noexcept;

	nlohmann::json j;

	std::function<void(const std::array<const Crew *, SLOT_COUNT>&, double)> progressUpdate;
	std::array<std::string, SLOT_COUNT> slotNames;
	std::array<size_t, SLOT_COUNT> slotSkills;
	std::array<std::string, SLOT_COUNT> slotSkillNames;
	std::array<size_t, SLOT_COUNT> slotTraits;
	size_t primarySkill;
	size_t secondarySkill;
	std::string primarySkillName;
	std::string secondarySkillName;
	const int shipAntiMatter;
	std::vector<Crew> roster;
	std::array<std::vector<Crew>, SLOT_COUNT> slotRosters;

	std::vector<std::array<const Crew *, SLOT_COUNT>> considered; // fillSlot recursion working copy

	ThreadPool threadPool;
	std::mutex calcMutex;

	const size_t config_searchDepth{6};
	const float config_skillPrimaryMultiplier{3.5};
	const float config_skillSecondaryMultiplier{2.5};
	const float config_skillMatchingMultiplier{1.0};
	const unsigned int config_traitScoreBoost{200};
	const bool config_includeAwayCrew{false};
	const bool config_includeFrozenCrew{false};

	std::array<std::vector<const Crew*>, SLOT_COUNT> sortedSlotRosters;

	std::array<const Crew *, SLOT_COUNT> bestconsidered;
	float bestscore{0.0};

	Timer totalTime{"voyage calculation"};
	Timer voyageCalcTime{"actual calc", false};
	Timer scoreUpdateTime{"score update", false};
};

} //namespace VoyageTools

#endif