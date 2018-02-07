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

struct Crew
{
    unsigned int id{0}; // TODO: should be crewId if someone has duplicates for some reason (2 FF/FE 5-stars of the same crew for the same skill)
    unsigned int command_skill{0};
    unsigned int science_skill{0};
    unsigned int security_skill{0};
    unsigned int engineering_skill{0};
    unsigned int diplomacy_skill{0};
    unsigned int medicine_skill{0};
    bool hasTrait{false}; // TODO

    double score(const char *skill, const char *primarySkill, const char *secondarySkill) const noexcept;
    unsigned int get(const char *skillName) const noexcept;
};

struct SortedCrew
{
    std::vector<Crew> command_skill;
    std::vector<Crew> science_skill;
    std::vector<Crew> security_skill;
    std::vector<Crew> engineering_skill;
    std::vector<Crew> diplomacy_skill;
    std::vector<Crew> medicine_skill;

    const std::vector<Crew> &get(const char *skillName) const noexcept;

    void setSearchDepth(const size_t depth) noexcept
    {
        command_skill.resize(depth);
        science_skill.resize(depth);
        security_skill.resize(depth);
        engineering_skill.resize(depth);
        diplomacy_skill.resize(depth);
        medicine_skill.resize(depth);
    }
};

class VoyageCalculator
{
  public:
    VoyageCalculator(const char* jsonInput) noexcept;

    const std::string& GetSlotName(size_t index) const noexcept
    {
        return slotNames[index];
    }

    std::array<const Crew *, SLOT_COUNT> Calculate(std::function<void(const std::array<const Crew *, SLOT_COUNT>&, double)> progressCallback, double& score) noexcept
    {
        progressUpdate = progressCallback;
        fillSlot(0);
        score = bestscore;
        return bestconsidered;
    }

  private:
    void fillSlot(size_t slot) noexcept;
    double calculateDuration(std::array<const Crew *, SLOT_COUNT> complement) noexcept;

    nlohmann::json j;

    std::function<void(const std::array<const Crew *, SLOT_COUNT>&, double)> progressUpdate;
    std::array<std::string, SLOT_COUNT> slotNames;
    std::array<const Crew *, SLOT_COUNT> considered; // TODO: per-thread
    std::string primarySkill;
    std::string secondarySkill;
    int shipAntiMatter;
    std::vector<Crew> roster;
    SortedCrew sortedRoster;

    std::array<const std::vector<Crew> *, SLOT_COUNT> slotRoster;

    std::array<const Crew *, SLOT_COUNT> bestconsidered;
    double bestscore{0.0};
};

} //namespace VoyageTools

#endif