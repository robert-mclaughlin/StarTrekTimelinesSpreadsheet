#include "ThreadPool.h"
#include <algorithm>

namespace VoyageTools {

ThreadPool::ThreadPool(size_t size)
{
	if (size == 0) {
		size = std::thread::hardware_concurrency();
		if (size <= 1) {
			size = 1;
		} else {
			size--; // leave a thread for the UI
		}
	}

	maxThreads = size;
}

void ThreadPool::add(task f)
{
	auto threadFunc = [=] {
		f(); // run initial task
		
		// check for more tasks
		for (;;) {
			task newTask;
			{lockScope ls(lock);
				if (tasks.empty())
					break;
				newTask = tasks.back();
				tasks.pop_back();
			}
			newTask();
		}

		// if no more tasks, clean up and exit
		threads.erase(std::find_if(threads.begin(), threads.end(), [](const std::thread &thatThread) {
			return thatThread.get_id() == std::this_thread::get_id();
		}));
	};

	lockScope ls(lock);
	if (threads.size() < maxThreads) {
		threads.emplace_back(threadFunc);
	} else {
		tasks.emplace_back(f);
	}
}

// there may be a better way of doing this
void ThreadPool::joinAll()
{
	for (;;) {
		std::thread *thread = nullptr;
		lock.lock();
		if (!threads.empty())
			thread = &threads.back();
		lock.unlock();
		if (thread) {
			thread->join();
		} else {
			break;
		}
	}
}

} //namespace VoyageTools