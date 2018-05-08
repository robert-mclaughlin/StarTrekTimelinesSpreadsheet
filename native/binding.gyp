{
    "targets": [
        {
            "target_name": "NativeExtension",
            "sources": [ "NativeExtension.cpp", "VoyageCalculator.cpp", "VoyageCrewRanker.cpp" ],
            "xcode_settings": { "OTHER_CFLAGS": [ "-std=gnu++14" ] },
            "include_dirs" : [
 	 			"<!(node -e \"require('nan')\")"
			]
        }
    ],
}