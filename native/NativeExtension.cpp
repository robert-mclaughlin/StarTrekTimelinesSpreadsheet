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

	void Execute(const Nan::AsyncProgressWorker::ExecutionProgress &progress) override
	{
		double finalScore;
		auto finalResult = voyageCalculator->Calculate([&](const std::array<const VoyageTools::Crew*, VoyageTools::SLOT_COUNT>& bestSoFar, double bestScore) {
			auto resultSoFar = ResultToString(bestSoFar, bestScore);
			progress.Send(resultSoFar.c_str(), resultSoFar.size());
		}, finalScore);

		result = ResultToString(finalResult, finalScore);
	}

	void HandleOKCallback() override
	{
		Nan::HandleScope scope;
		v8::Local<v8::Value> argv[] = { Nan::New(result.c_str(), result.size()).ToLocalChecked() };
		callback->Call(1, argv);
	};

	void HandleProgressCallback(const char *data, size_t size) override
	{
		Nan::HandleScope scope;
		v8::Local<v8::Value> argv[] = { Nan::New(data, size).ToLocalChecked() };
		progressCallback->Call(1, argv);
	}

private:
	std::string ResultToString(const std::array<const VoyageTools::Crew*, VoyageTools::SLOT_COUNT>& res, double score) noexcept
	{
		nlohmann::json j;
		for (int i = 0; i < VoyageTools::SLOT_COUNT; i++)
		{
			j["selection"][voyageCalculator->GetSlotName(i)] = res[i]->id;
		}
		j["score"] = score;
		return j.dump();
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
		: Nan::AsyncProgressWorker(callback)
		, progressCallback(progressCallback)
		, input(input)
	{
	}

	void Execute(const Nan::AsyncProgressWorker::ExecutionProgress &progress) override
	{
		using namespace VoyageTools;
		RankedResult result = RankVoyageCrew(input.c_str());
		
		{ // stringify crew ranking
			const std::vector<RankedCrew> &rankedCrew = result.Crew;

			std::stringstream ss;
			ss << "Score,";
			for (unsigned int iAlt = 0; iAlt < RankedCrew::altLevels; ++iAlt) {
				ss << "Alt " << iAlt+1 << ",";
			}
			ss << "Status,Crew,Voyages\n";

			for (const RankedCrew &crew : rankedCrew) {
				ss << crew.score << ",";
				for (unsigned int iAlt = 0; iAlt < RankedCrew::altLevels; ++iAlt) {
					ss << (crew.altScores.empty()?0:crew.altScores[iAlt]) << ",";
				}
				std::string status;
				if (crew.crew.frozen) {
					status = "F";
				} else if (crew.crew.ff100) {
					status = "I?";
				} else {
					status = '0'+crew.crew.max_rarity;
				}
				ss << status << "," << crew.crew.name << ",";
				for (auto skills : crew.voySkills) {
					ss << skillNames[skills.first] << "/" << skillNames[skills.second] << " ";
				}
				for (auto altSkills : crew.altVoySkills) {
					ss << altSkillNames[altSkills.first] << "/" << altSkillNames[altSkills.second] << " ";
				}
				ss << "\n";
			}

			rankResult = ss.str();
		}

		{ // stringify voyage estimates
			std::stringstream ss;
			ss << "Primary,Secondary,Estimate,Crew\n";

			for (const VoyageEstimate &estimate : result.Estimates) {
				ss << skillNames[estimate.primarySkill] << "," << skillNames[estimate.secondarySkill] << ","
					<< std::setprecision(2) << estimate.estimate << ",";
				for (const Crew &crew : estimate.crew) {
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
			Nan::New(estimateResult.c_str(), estimateResult.size()).ToLocalChecked()
		};
		callback->Call(2, argv);
	};

	void HandleProgressCallback(const char *data, size_t size) override
	{
		Nan::HandleScope scope;
		v8::Local<v8::Value> argv[] = { Nan::New(data, size).ToLocalChecked() };
		progressCallback->Call(1, argv);
	}

private:
	static constexpr std::array<const char*,VoyageTools::SKILL_COUNT> skillNames = {"CMD", "SCI", "SEC", "ENG", "DIP", "MED"};
	static constexpr std::array<const char*,VoyageTools::SKILL_COUNT> altSkillNames = {"cmd", "sci", "sec", "eng", "dip", "med"};

	Nan::Callback *progressCallback;
	std::string rankResult;
	std::string estimateResult;
	std::unique_ptr<VoyageTools::VoyageCalculator> voyageCalculator;
};

NAN_METHOD(calculateVoyageRecommendations)
{
	//std::cout << std::thread::hardware_concurrency() << " concurrent threads are supported.\n";

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

	Nan::AsyncQueueWorker(new VoyageWorker(new Nan::Callback(callbackHandle), new Nan::Callback(progressCallbackHandle),
		*v8::String::Utf8Value(info[0]->ToString())));

	//return undefined
}

NAN_METHOD(calculateVoyageCrewRank)
{
	//std::cout << std::thread::hardware_concurrency() << " concurrent threads are supported.\n";

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

	Nan::AsyncQueueWorker(new VoyageCrewRankWorker(new Nan::Callback(callbackHandle), new Nan::Callback(progressCallbackHandle),
		*v8::String::Utf8Value(info[0]->ToString())));

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
