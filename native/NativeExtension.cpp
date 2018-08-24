#include "NativeExtension.h"
#include "VoyageCalculator.h"
#include "VoyageCrewRanker.h"

using v8::FunctionTemplate;

class VoyageWorker : public Nan::AsyncProgressWorker
{
  public:
	VoyageWorker(Nan::Callback *callback, Nan::Callback *progressCallback, const char *input)
		: Nan::AsyncProgressWorker(callback), progressCallback(progressCallback)
	{
		voyageCalculator = std::unique_ptr<VoyageTools::VoyageCalculator>(new VoyageTools::VoyageCalculator(input));
	}

	~VoyageWorker()
	{
		// Apparently this is needed for proper resource cleanup
		delete progressCallback;
	}

	void Execute(const Nan::AsyncProgressWorker::ExecutionProgress &progress) override
	{
		float finalScore;
		auto finalResult = voyageCalculator->Calculate([&](const std::array<const VoyageTools::Crew *, VoyageTools::SLOT_COUNT> &bestSoFar, float bestScore) {
			auto resultSoFar = ResultToStruct(bestSoFar, bestScore);
			progress.Send(reinterpret_cast<char*>(&resultSoFar), sizeof(resultSoFar) / sizeof(char));
		}, finalScore);

		result = ResultToString(finalResult, finalScore);
	}

	void HandleOKCallback() override
	{
		Nan::HandleScope scope;
		v8::Local<v8::Value> argv[] = {Nan::New(result.c_str(), result.size()).ToLocalChecked()};
		callback->Call(1, argv, async_resource);
	}

	void HandleProgressCallback(const char *data, size_t size) override
	{
		Nan::HandleScope scope;

		// This looks strange, but the v8 Buffer takes ownership of the memory and will release it when the Js object
		// goes out of scope; hence, we can't use smart pointers and stuff
		char* transferMyOwnership = new char[size];
		memcpy(transferMyOwnership, data, size);

		Nan::MaybeLocal<v8::Object> newBuf = Nan::NewBuffer(transferMyOwnership, size);
		v8::Local<v8::Value> argv[] = {newBuf.ToLocalChecked()};
		progressCallback->Call(1, argv, async_resource);
	}

  private:
	std::string ResultToString(const std::array<const VoyageTools::Crew *, VoyageTools::SLOT_COUNT> &res, float score) noexcept
	{
		nlohmann::json j;
		j["score"] = score;
		j["selection"] = nlohmann::json::array();
		for (int i = 0; i < VoyageTools::SLOT_COUNT; i++)
		{
			j["selection"].push_back(nlohmann::json::object({ {"slotId", voyageCalculator->GetSlotId(i)}, {"crewId", res[i]->id} }));
		}

		return j.dump();
	}

	struct PackedResult
	{
		float score;
		std::uint8_t slotIds[VoyageTools::SLOT_COUNT];
		std::uint32_t crewIds[VoyageTools::SLOT_COUNT];
	};

	PackedResult ResultToStruct(const std::array<const VoyageTools::Crew *, VoyageTools::SLOT_COUNT> &res, float score) noexcept
	{
		PackedResult pkResult;
		pkResult.score = score;

		for (std::uint8_t i = 0; i < VoyageTools::SLOT_COUNT; i++)
		{
			pkResult.slotIds[i] = voyageCalculator->GetSlotId(i);
			pkResult.crewIds[i] = res[i]->id;
		}

		return pkResult;
	}

	Nan::Callback *progressCallback;
	std::string result;
	std::unique_ptr<VoyageTools::VoyageCalculator> voyageCalculator;
};

class VoyageCrewRankWorker : public Nan::AsyncProgressWorker
{
	std::string input;

  public:
	VoyageCrewRankWorker(Nan::Callback *callback, Nan::Callback *progressCallback, const char *input)
		: Nan::AsyncProgressWorker(callback), progressCallback(progressCallback), input(input)
	{
	}

	~VoyageCrewRankWorker()
	{
		// Apparently this is needed for proper resource cleanup
		delete progressCallback;
	}

	void Execute(const Nan::AsyncProgressWorker::ExecutionProgress &progress) override
	{
		using namespace VoyageTools;
		RankedResult result = RankVoyageCrew(input.c_str());

		{ // stringify crew ranking
			const std::vector<RankedCrew> &rankedCrew = result.Crew;

			std::stringstream ss;
			ss << "Score,";
			for (unsigned int iAlt = 0; iAlt < RankedCrew::altLevels; ++iAlt)
			{
				ss << "Alt " << iAlt + 1 << ",";
			}
			ss << "Status,Crew,Voyages\n";

			for (const RankedCrew &crew : rankedCrew)
			{
				ss << crew.score << ",";
				for (unsigned int iAlt = 0; iAlt < RankedCrew::altLevels; ++iAlt)
				{
					ss << (crew.altScores.empty() ? 0 : crew.altScores[iAlt]) << ",";
				}
				std::string status;
				if (crew.crew.traitIds.test(FROZEN_BIT))
				{
					status = "F";
				}
				else if (crew.crew.ff100)
				{
					status = "I?";
				}
				else
				{
					status = '0' + crew.crew.max_rarity;
				}
				ss << status << "," << crew.crew.name << ",";
				for (auto skills : crew.voySkills)
				{
					ss << skillNames[skills.first] << "/" << skillNames[skills.second] << " ";
				}
				for (auto altSkills : crew.altVoySkills)
				{
					ss << altSkillNames[altSkills.first] << "/" << altSkillNames[altSkills.second] << " ";
				}
				ss << "\n";
			}

			rankResult = ss.str();
		}

		{ // stringify voyage estimates
			std::stringstream ss;
			ss << "Primary,Secondary,Estimate,Crew\n";

			for (const VoyageEstimate &estimate : result.Estimates)
			{
				ss << skillNames[estimate.primarySkill] << "," << skillNames[estimate.secondarySkill] << ","
				   << std::setprecision(2) << estimate.estimate << ",";
				for (const Crew &crew : estimate.crew)
				{
					if (&crew != &estimate.crew[0])
						ss << " | ";
					ss << crew.name;
				}
				ss << "\n";
			}

			estimateResult = ss.str();
		}
	}

	void HandleOKCallback() override
	{
		Nan::HandleScope scope;
		v8::Local<v8::Value> argv[] = {
			Nan::New(rankResult.c_str(), rankResult.size()).ToLocalChecked(),
			Nan::New(estimateResult.c_str(), estimateResult.size()).ToLocalChecked()};
		callback->Call(2, argv, async_resource);
	};

	void HandleProgressCallback(const char *data, size_t size) override
	{
		Nan::HandleScope scope;
		v8::Local<v8::Value> argv[] = {Nan::New(data, size).ToLocalChecked()};
		progressCallback->Call(1, argv, async_resource);
	}

  private:
	static constexpr std::array<const char *, VoyageTools::SKILL_COUNT> skillNames = {"CMD", "SCI", "SEC", "ENG", "DIP", "MED"};
	static constexpr std::array<const char *, VoyageTools::SKILL_COUNT> altSkillNames = {"cmd", "sci", "sec", "eng", "dip", "med"};

	Nan::Callback *progressCallback;
	std::string rankResult;
	std::string estimateResult;
	std::unique_ptr<VoyageTools::VoyageCalculator> voyageCalculator;
};

NAN_METHOD(calculateVoyageRecommendations)
{
	if (info.Length() != 3)
	{
		Nan::ThrowTypeError("Wrong number of arguments; 3 expected");
		return;
	}

	if (!info[0]->IsString())
	{
		Nan::ThrowTypeError("Wrong argument (string expected)");
		return;
	}

	if (!info[1]->IsFunction())
	{
		Nan::ThrowTypeError("Wrong argument (callback expected)");
		return;
	}

	if (!info[2]->IsFunction())
	{
		Nan::ThrowTypeError("Wrong argument (callback expected)");
		return;
	}

	v8::Local<v8::Function> callbackHandle = info[1].As<v8::Function>();
	v8::Local<v8::Function> progressCallbackHandle = info[2].As<v8::Function>();

	Nan::Utf8String utf8_value(info[0]);
	std::string input(*utf8_value, utf8_value.length());

	Nan::AsyncQueueWorker(new VoyageWorker(new Nan::Callback(callbackHandle), new Nan::Callback(progressCallbackHandle), input.c_str()));

	//return undefined
}

NAN_METHOD(calculateVoyageCrewRank)
{
	if (info.Length() != 3)
	{
		Nan::ThrowTypeError("Wrong number of arguments; 3 expected");
		return;
	}

	if (!info[0]->IsString())
	{
		Nan::ThrowTypeError("Wrong argument (string expected)");
		return;
	}

	if (!info[1]->IsFunction())
	{
		Nan::ThrowTypeError("Wrong argument (callback expected)");
		return;
	}

	if (!info[2]->IsFunction())
	{
		Nan::ThrowTypeError("Wrong argument (callback expected)");
		return;
	}

	v8::Local<v8::Function> callbackHandle = info[1].As<v8::Function>();
	v8::Local<v8::Function> progressCallbackHandle = info[2].As<v8::Function>();

	Nan::Utf8String utf8_value(info[0]);
	std::string input(*utf8_value, utf8_value.length());

	Nan::AsyncQueueWorker(new VoyageCrewRankWorker(new Nan::Callback(callbackHandle), new Nan::Callback(progressCallbackHandle), input.c_str()));

	//return undefined
}

NAN_MODULE_INIT(InitAll)
{
	Nan::Set(target, Nan::New("calculateVoyageRecommendations").ToLocalChecked(),
			 Nan::GetFunction(Nan::New<FunctionTemplate>(calculateVoyageRecommendations)).ToLocalChecked());

	Nan::Set(target, Nan::New("calculateVoyageCrewRank").ToLocalChecked(),
			 Nan::GetFunction(Nan::New<FunctionTemplate>(calculateVoyageCrewRank)).ToLocalChecked());
}

NODE_MODULE(NativeExtension, InitAll)
