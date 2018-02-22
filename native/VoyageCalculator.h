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
#include "json.hpp"

namespace VoyageTools
{
extern Log log;

constexpr unsigned int SLOT_COUNT = 12;
constexpr unsigned int SKILL_COUNT = 6;

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
	mutable bool considered{false};
	const Crew *original{nullptr};
	unsigned int score{0};
};

struct SortedCrew
{
	std::array<std::vector<Crew>, SLOT_COUNT> slotRosters;

	void setSearchDepth(size_t depth) noexcept
	{
		this->depth = depth;
	}

	size_t depth = 0;
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
	void fillSlot(size_t slot, unsigned int minScore, size_t minDepth) noexcept;
	float calculateDuration(std::array<const Crew *, SLOT_COUNT> complement, bool debug = false) noexcept;
	unsigned int computeScore(const Crew& crew, size_t skill, size_t trait) const noexcept;

	nlohmann::json j;

	std::function<void(const std::array<const Crew *, SLOT_COUNT>&, double)> progressUpdate;
	std::array<std::string, SLOT_COUNT> slotNames;
	std::array<size_t, SLOT_COUNT> slotSkills;
	std::array<std::string, SLOT_COUNT> slotSkillNames;
	std::array<size_t, SLOT_COUNT> slotTraits;
	std::array<const Crew *, SLOT_COUNT> considered; // TODO: per-thread
	size_t primarySkill;
	size_t secondarySkill;
	std::string primarySkillName;
	std::string secondarySkillName;
	const int shipAntiMatter;
	std::vector<Crew> roster;
	SortedCrew sortedRoster;

	const float config_skillPrimaryMultiplier{3.5};
	const float config_skillSecondaryMultiplier{2.5};
	const float config_skillMatchingMultiplier{1.0};
	const unsigned int config_traitScoreBoost{200};
	const bool config_includeAwayCrew{false};
	const bool config_includeFrozenCrew{false};

	std::array<const std::vector<Crew> *, SLOT_COUNT> slotRoster;

	std::array<const Crew *, SLOT_COUNT> bestconsidered;
	float bestscore{0.0};

	Timer timer{"voyage calculation"};
	Timer voyageCalcTime{"actual calc", false};
};

} //namespace VoyageTools

#endif