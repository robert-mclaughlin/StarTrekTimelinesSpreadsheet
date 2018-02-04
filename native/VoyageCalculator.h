#ifndef VOYAGE_CALCULATOR_H
#define VOYAGE_CALCULATOR_H
#include <array>
#include <vector>
#include <algorithm>
#include <functional>

#include "json.hpp"

namespace VoyageTools
{

constexpr unsigned int SLOT_COUNT = 12;
constexpr unsigned int SEARCH_DEPTH = 6; // TODO: this should be configurable by the caller

struct Crew
{
    int16_t id{0}; // TODO: should be crewId if someone has duplicates for some reason (2 FF/FE 5-stars of the same crew for the same skill)
    int16_t command_skill{0};
    int16_t science_skill{0};
    int16_t security_skill{0};
    int16_t engineering_skill{0};
    int16_t diplomacy_skill{0};
    int16_t medicine_skill{0};
    bool hasTrait{false}; // TODO

    double score(const char *skill, const char *primarySkill, const char *secondarySkill) const noexcept;
    int16_t get(const char *skillName) const noexcept;
};

struct SortedCrew
{
    std::array<Crew, SEARCH_DEPTH> command_skill;
    std::array<Crew, SEARCH_DEPTH> science_skill;
    std::array<Crew, SEARCH_DEPTH> security_skill;
    std::array<Crew, SEARCH_DEPTH> engineering_skill;
    std::array<Crew, SEARCH_DEPTH> diplomacy_skill;
    std::array<Crew, SEARCH_DEPTH> medicine_skill;

    const std::array<Crew, SEARCH_DEPTH> &get(const char *skillName) const noexcept;
};

class VoyageCalculator
{
  public:
    VoyageCalculator(const char* jsonInput) noexcept;

    const std::string& GetSlotName(int index) const noexcept
    {
        return slotNames[index];
    }

    std::array<const Crew *, SLOT_COUNT> Calculate(std::function<void(const std::array<const Crew *, SLOT_COUNT>&)> progressCallback) noexcept
    {
        progressUpdate = progressCallback;
        fillSlot(0);
        return bestconsidered;
    }

  private:
    void fillSlot(size_t slot) noexcept;
    double calculateDuration(std::array<const Crew *, SLOT_COUNT> complement) noexcept;

    nlohmann::json j;

    std::function<void(const std::array<const Crew *, SLOT_COUNT>&)> progressUpdate;
    std::array<std::string, SLOT_COUNT> slotNames;
    std::array<const Crew *, SLOT_COUNT> considered; // TODO: per-thread
    std::string primarySkill;
    std::string secondarySkill;
    int32_t shipAntiMatter;
    std::vector<Crew> roster;
    SortedCrew sortedRoster;

    std::array<const std::array<Crew, SEARCH_DEPTH> *, SLOT_COUNT> slotRoster;

    std::array<const Crew *, SLOT_COUNT> bestconsidered;
    double bestscore{0.0};
};

} //namespace VoyageTools

#endif